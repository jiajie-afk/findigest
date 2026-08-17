# Module boundaries

FinDigest keeps Landing polish, Stock research UI, and domain services separable so Wave work does not re-melt into a monolith.

```
src/
├── views/                 # Route pages only — compose components + stores
│   ├── Landing.vue        # Marketing shell (no valuation math)
│   ├── ButlerHome.vue     # Today desk / briefing
│   ├── Stock.vue          # Stock page orchestration
│   └── Portfolio.vue      # Holdings CRUD + search
├── components/
│   ├── landing/*          # Landing sections (Wave2 owns LandingHero)
│   ├── stock/*            # StockValuation / Management / Sentiment / Events
│   └── dashboard/*        # Workspace briefing widgets
├── services/              # Pure(ish) domain logic — no Vue SFC imports
│   ├── valuation.js       # ~11 archetype IV engine
│   ├── paradigmResolver.js# catalog angles → archetypes (ENGINE_HINT_* frozen)
│   ├── entitlements.js    # billing → can* flags (single commercial truth)
│   ├── api.js / apiClient # proxy-first market data + asOf/source meta
│   └── vault.js / crypto  # account vault + session helpers
├── store/                 # Pinia — persistence adapters around services
├── data/                  # Static datasets + productStats / paradigms
└── utils/                 # Tiny shared helpers (universeSearch, format)
api/ + lib/                # Vercel serverless: proxy (rate-limited), vault, billing
```

## Hard rules

1. **Do not** import Vue components from `services/`.
2. **Do not** put IV math in Landing or AppNav.
3. Market data goes through `/api/proxy` first; JSONP is optional fallback and must surface `source=jsonp-fallback` when used.
4. Pro capability gates go through `entitlements` / billing `can*` — never `billing.isPro && user.isProEdition` ad hoc.
5. `ENGINE_HINT_TO_ARCHETYPE` is the frozen compute map; run `npm run check:engine-hints` before merging paradigm catalog edits.
