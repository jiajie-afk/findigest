import { parseOcrText, scoreImportRows } from './holdingsImport.js'

let workerPromise = null
let progressCb = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const [{ createWorker }, workerUrl, coreUrl] = await Promise.all([
        import('tesseract.js'),
        import('tesseract.js/dist/worker.min.js?url'),
        import('tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'),
      ])
      const worker = await createWorker('chi_sim', 1, {
        workerPath: workerUrl.default,
        corePath: coreUrl.default,
        workerBlobURL: true,
        logger: (m) => {
          if (m?.status === 'recognizing text' && typeof progressCb === 'function') {
            progressCb(m.progress)
          }
        },
      })
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
      })
      return worker
    })()
  }
  return workerPromise
}

function invertCanvas(src) {
  const canvas = document.createElement('canvas')
  canvas.width = src.width
  canvas.height = src.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(src, 0, 0)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i]
    d[i + 1] = 255 - d[i + 1]
    d[i + 2] = 255 - d[i + 2]
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

export async function preprocessHoldingsImage(fileOrBlob) {
  const bitmap = await createImageBitmap(fileOrBlob)
  const scale = Math.min(3, Math.max(1, 1600 / bitmap.width, 1000 / bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.filter = 'grayscale(1) contrast(1.35) brightness(1.05)'
  ctx.drawImage(bitmap, 0, 0, w, h)
  ctx.filter = 'none'
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  let sum = 0
  for (let i = 0; i < d.length; i += 4) sum += d[i]
  const avg = sum / (d.length / 4)
  if (avg < 108) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i + 1] = d[i + 2] = 255 - d[i]
    }
    ctx.putImageData(img, 0, 0)
  }
  try {
    bitmap.close()
  } catch {
    /* ignore */
  }
  return canvas
}

export async function recognizeHoldingsImage(fileOrBlob, opts = {}) {
  const onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : () => {}
  onStatus('正在增强截图…')
  const canvas = await preprocessHoldingsImage(fileOrBlob)
  onStatus('加载中文识别模型…')
  const worker = await getWorker()
  progressCb = (p) => onStatus(`识别中 ${Math.round((p || 0) * 100)}%`)

  let best = { rows: [], warnings: [], text: '' }
  let bestScore = -1

  const tryOne = async (image, psm, label) => {
    onStatus(label)
    await worker.setParameters({
      tessedit_pageseg_mode: String(psm),
      preserve_interword_spaces: '1',
    })
    const { data } = await worker.recognize(image)
    const parsed = parseOcrText(data?.text || '')
    const score = scoreImportRows(parsed.rows)
    if (score > bestScore) {
      bestScore = score
      best = { ...parsed, text: data?.text || '' }
    }
  }

  await tryOne(canvas, 6, '识别表格…')
  if (bestScore < 8) await tryOne(canvas, 4, '按列再认一遍…')
  if (bestScore < 8) await tryOne(invertCanvas(canvas), 6, '反色后再认…')

  progressCb = null
  if (!best.rows.length) {
    best.warnings = (best.warnings || []).concat(['没认出持仓行，请换更清晰的截图，或改用粘贴 / CSV'])
  }
  return best
}
