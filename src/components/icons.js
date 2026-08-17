import { h } from 'vue'

/** Tiny local icons — same API surface as the old Phosphor imports (size/weight). */
function makeIcon(draw) {
  return {
    name: 'FdIcon',
    props: {
      size: { type: [Number, String], default: 16 },
      weight: { type: String, default: 'bold' },
    },
    setup(props) {
      return () =>
        h(
          'svg',
          {
            xmlns: 'http://www.w3.org/2000/svg',
            width: props.size,
            height: props.size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': props.weight === 'bold' ? 2.25 : 1.75,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'aria-hidden': 'true',
            focusable: 'false',
          },
          draw(),
        )
    },
  }
}

const path = (d) => h('path', { d })
const circle = (cx, cy, r) => h('circle', { cx, cy, r })
const rect = (attrs) => h('rect', attrs)
const line = (x1, y1, x2, y2) => h('line', { x1, y1, x2, y2 })

export const PhNewspaper = makeIcon(() => [
  path('M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2'),
  line(18, 14, 10, 14),
  line(15, 18, 10, 18),
  path('M10 6h8v4h-8z'),
])

export const PhBroadcast = makeIcon(() => [
  path('M4.9 19.1C1 15.2 1 8.8 4.9 4.9'),
  path('M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5'),
  path('M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5'),
  path('M19.1 4.9C23 8.8 23 15.2 19.1 19.1'),
  circle(12, 12, 2),
])

export const PhPlus = makeIcon(() => [line(5, 12, 19, 12), line(12, 5, 12, 19)])

export const PhUser = makeIcon(() => [
  path('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'),
  circle(12, 7, 4),
])

export const PhBriefcase = makeIcon(() => [
  rect({ width: 20, height: 14, x: 2, y: 7, rx: 2, ry: 2 }),
  path('M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'),
])

export const PhChartLineUp = makeIcon(() => [
  path('M3 3v18h18'),
  path('m19 9-5 5-4-4-3 3'),
])

export const PhCalendarBlank = makeIcon(() => [
  rect({ width: 18, height: 18, x: 3, y: 4, rx: 2, ry: 2 }),
  line(16, 2, 16, 6),
  line(8, 2, 8, 6),
  line(3, 10, 21, 10),
])

export const PhFiles = makeIcon(() => [
  path('M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z'),
  path('M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8'),
  path('M15 2v5h5'),
])

export const PhUploadSimple = makeIcon(() => [
  path('M12 3v12'),
  path('m7 8 5-5 5 5'),
  path('M5 21h14'),
])
