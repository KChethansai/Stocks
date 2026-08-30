Absolutely. Here is the **single combined `design.md`** containing the current design audit **plus the complete redesign specification**. You can drop this directly into the repo and give it to Stitch/OpenCode as the single source of truth.

````md # MarketForge — Complete Design Specification

> Single source of truth for the MarketForge UI/UX redesign. > > This document describes the current design system, existing product structure, design strengths/weaknesses, and the target redesign.

---

# 1. Product Overview

**MarketForge** is a stock-market paper trading platform.

Users can:

- Explore stock market data
- Search and filter stocks
- View stock price history
- View line and candlestick charts
- Manage a watchlist
- Buy and sell stocks using virtual money
- Track portfolio holdings
- Track portfolio performance
- Analyze portfolio allocation
- Review transactions
- Export portfolio data
- Manage their profile

The application is already functionally developed.

The redesign should primarily be a **frontend/UI/UX transformation**, not a rewrite of the trading system.

---

# 2. Current Product Architecture

The application currently contains major areas equivalent to:

```text
/
├── Landing
├── Login
├── Register
│
└── Authenticated Application
    ├── Market
    ├── Portfolio
    ├── Transactions
    ├── Analytics
    └── Profile
````

The existing application already has:

- authentication
- protected routes
- market data
- polling
- stock search
- filtering
- sorting
- watchlists
- charts
- trading
- portfolio calculations
- P&L
- analytics
- transaction history
- **CSV** export

These capabilities must remain functional after the redesign.

---

# 3. Core Redesign Principle

Do **NOT** rebuild MarketForge as a generic dashboard.

Do **NOT** replace the product's financial identity with a generic SaaS aesthetic.

The current product is a:

> Dark Professional Financial Terminal

The target should become:

> Modern Professional Trading Workspace

The redesign should preserve the precision and density of the existing terminal while making it:

- cleaner
- easier to navigate
- more visually sophisticated
- more approachable
- more responsive
- more consistent
- more polished

---

# 4. Current Design Language

The current visual identity is based on:

- dark backgrounds
- dark panels
- thin borders
- blue accents
- cyan profit states
- red loss states
- Inter typography
- **IBM** Plex Mono for financial data
- compact cards
- dense information layouts
- financial charts
- sparklines
- subtle terminal/grid effects
- small technical controls

The current design is intentionally professional and data-oriented.

---

# 5. Current Color System

The current design tokens are:

```text Background #0D0D0F

### Secondary Background

#18181C

### Card Surface

#2A2A32

### Primary Text

#FFFFFF

### Secondary Text

rgba(**255**,**255**,**255**,0.70)

### Muted Text

rgba(**255**,**255**,**255**,0.45)

### Primary Accent

#5B8AF0

Success / Profit #00E5CC

Danger / Loss #FF4560

Warning #F59E0B

Info #5B8AF0 ```

Surface states:

```text Hover rgba(**255**,**255**,**255**,0.04)

Active rgba(**255**,**255**,**255**,0.08) ```

Borders:

```text Default rgba(**255**,**255**,**255**,0.08)

Hover rgba(**255**,**255**,**255**,0.15) ```

Chart colors:

```text Primary #5B8AF0

Profit #00E5CC

Loss #FF4560 ```

Shadows:

```text Small 0 4px 12px rgba(0,0,0,0.15)

Medium 0 8px 24px rgba(0,0,0,0.25) ```

---

# 6. Target Color Direction

The redesign should remain dark-first.

Preferred direction:

```text Background #09090B / #0B0D10

Surface #111318

### Elevated Surface

#151820

Border rgba(**255**,**255**,**255**,0.08)

### Primary Text

#F5F7FA

### Secondary Text

#9CA3AF

Muted #667085

### Primary Accent

#3B82F6

Positive #22C55E

Negative #EF4444 ```

However, the redesign does **NOT** need to blindly replace every current color.

Preserve the current MarketForge identity where useful.

The final palette must remain:

- dark
- restrained
- professional
- high contrast
- financial

---

# 7. Typography

Current fonts:

```text Primary: Inter

Technical / Financial: **IBM** Plex Mono ```

Maintain the concept of two typography roles.

Use the primary font for:

- navigation
- headings
- descriptions
- buttons
- forms
- general UI

Use monospace for:

- stock prices
- percentages
- quantities
- ticker symbols
- timestamps
- chart labels
- technical data

Financial numbers should have strong hierarchy.

---

# 8. Typography Hierarchy

Use approximately:

```text ### Page Heading 32–40px

### Section Heading

18–22px

### Card Heading

14–18px

Body 14–16px

Secondary 12–14px

### Financial Value

20–40px depending on importance

Technical / Metadata 11–13px ```

Do not make every number huge.

Large numbers should communicate importance.

---

# 9. Current Card System

Current cards generally use:

```text border-radius: 10–12px

border: 1px solid rgba(**255**,**255**,**255**,0.08)

background: #18181C / #2A2A32

subtle shadow ```

General cards use generous but compact padding.

Metric cards are smaller and denser.

Cards have subtle hover states:

```text border becomes brighter shadow becomes stronger ```

The redesign should avoid excessive pill-shaped or heavily rounded cards.

---

# 10. Target Card System

Cards should feel:

- refined
- lightweight
- dense
- structured

Preferred:

```text 8–12px radius 1px subtle border minimal shadow small surface contrast ```

Avoid:

- huge rounded corners
- excessive shadows
- colorful card backgrounds
- excessive gradients
- glass everywhere

---

# 11. Current Terminal Aesthetic

The current code contains visual concepts such as:

```text terminal-panel terminal-surface terminal-grid terminal-chart terminal-mono terminal-stat terminal-ticker ```

These create:

- technical panels
- chart grids
- ticker strips
- monospace controls
- compact financial interfaces

This identity should be **refined rather than blindly removed**.

Reduce the *cyber/terminal* feeling while preserving the professional trading-terminal character.

---

# 12. Target Visual Identity

The desired direction is:

```text
TradingView
- Linear
- Stripe
- Modern fintech
```

Do **NOT** copy any of them.

The result must feel like an original MarketForge product.

Desired qualities:

```text Professional Precise Modern Calm Data-rich Premium Approachable ```

Avoid:

```text Cyberpunk Neon Gaming UI Generic AI dashboard Overly colorful SaaS Excessive glassmorphism Excessive gradients ```

---

# 13. Application Shell

Replace the existing basic authenticated navigation with a proper application shell.

Target:

```text ┌──────────────────────────────────────────────────────────────┐ │ MarketForge     Search stocks...      🔔   $**104**,**892**   👤    │ ├──────────────┬───────────────────────────────────────────────┤ │              │                                               │ │ Dashboard    │                                               │ │ Markets      │                                               │ │ Watchlist    │                 **MAIN** **CONTENT**                  │ │ Portfolio    │                                               │ │ Analytics    │                                               │ │ Activity     │                                               │ │              │                                               │ │ ───────────  │                                               │ │ Settings     │                                               │ │ Profile      │                                               │ └──────────────┴───────────────────────────────────────────────┘ ```

---

# 14. Sidebar

The sidebar should contain:

```text MarketForge logo

Dashboard Markets Watchlist Portfolio Analytics Activity

────────────

Settings Profile ```

Requirements:

- active state
- hover state
- collapse support
- mobile drawer
- keyboard accessibility
- consistent icons
- subtle transitions

Use Kokonut UI where appropriate.

---

# 15. Topbar

Topbar should contain:

```text ### Global Search

### Market Status

Notifications

### User Avatar

```

Global search should support:

```text Ctrl + K ```

or:

```text ⌘ + K ```

depending on platform.

---

# 16. Global Command Palette

Create a global command palette.

Example:

```text ┌─────────────────────────────────────────────┐ │ Search stocks, pages, actions...            │ ├─────────────────────────────────────────────┤ │                                             │ │ **AAPL**   Apple                                │ │ **NVDA**   **NVIDIA**                               │ │ **MSFT**   Microsoft                            │ │                                             │ │ Navigation                                  │ │ Dashboard                                   │ │ Markets                                     │ │ Portfolio                                   │ │ Analytics                                   │ │                                             │ │ Actions                                     │ │ Buy stock                                   │ │ Sell stock                                  │ │ Add to watchlist                            │ └─────────────────────────────────────────────┘ ```

Use a suitable Kokonut/shadcn command component.

---

# 17. Public Information Architecture

Public pages should include:

```text / /login /register ```

Optional supporting pages:

```text /about /features ```

The public experience should visually connect to the authenticated product.

---

# 18. Landing Page — Current

Current landing page contains:

```text MarketForge

Welcome to MarketForge

Experience the stock market without the risk.

[Explore Market] [View Portfolio]

$**100**,**000** Starting virtual balance

30 Stocks

60 sec Market sync ```

Then:

```text Why choose MarketForge?

Real-time Data Risk-free Trading ### Advanced Analytics ```

Then a **CTA**/footer.

---

# 19. Landing Page — Target

Hero:

```text **MARKETFORGE**

Practice trading. Understand markets. Build conviction.

[Start Trading] [Explore Markets] ```

Include a subtle market visualization.

Below:

```text $**100K** Virtual capital

30+ Stocks

Real-time Market updates ```

Then:

```text Real-time market data Risk-free trading Portfolio analytics ```

Then a beautiful product preview.

Then:

```text Ready to start practicing?

[Create Account] ```

Use Magic UI and React Bits selectively.

---

# 20. Dashboard — Target

Create a dedicated authenticated dashboard.

Header:

```text Good morning, <user>

Here's your portfolio overview. ```

Primary portfolio metric:

```text ### Portfolio Value

$**104**,**892**.21

+$4,**892**.21 +4.89% ```

Supporting metrics:

```text ### Cash Balance $38,**492**

Invested $66,**400**

Today's P&L +$1,**284** ```

---

# 21. Dashboard Performance

Create a large portfolio performance chart.

Controls:

```text 1D 1W 1M 3M 6M 1Y **ALL** ```

The chart should be one of the main visual elements.

Keep it clean and financial.

---

# 22. Dashboard Watchlist

Show:

```text **AAPL** Apple $**227**.14 +1.42% sparkline

**NVDA** **NVIDIA** $**182**.31 +3.12% sparkline

**MSFT** Microsoft $**514**.92 +1.10% sparkline ```

Include quick actions where appropriate.

---

# 23. Dashboard Market Movers

Create:

```text ### Top Gainers ### Top Losers ### Most Active ```

Keep the information compact.

Use semantic green/red.

---

# 24. Dashboard Quick Actions

Provide:

```text ### Explore Markets ### View Portfolio ### Analyze Portfolio ```

Primary actions should be immediately visible.

---

# 25. Markets — Current

The current Market page is the most complex financial screen.

It includes:

- market summary
- stock search
- filtering
- sorting
- watchlist
- gainers
- losers
- most active stocks
- selected stock
- line chart
- candlestick chart
- chart ranges
- quick order
- buy/sell
- quantity controls
- order confirmation

Do not remove these capabilities.

---

# 26. Markets — Target

Markets should become the flagship workspace.

Header:

```text Markets

Explore stocks and track market movements. ```

Search:

```text Search stocks, companies or sectors... ```

Controls:

```text Filters Sort Watchlist ```

Market overview:

```text S&P **500** 5,**892** +1.24%

**NASDAQ** 19,**402** +2.12%

**DOW** 43,**812** +0.81% ```

---

# 27. Markets Main Layout

Desktop:

```text ┌──────────────────────┬─────────────────────────────────┐ │ **STOCKS**               │ **STOCK** **DETAIL**                    │ │                      │                                 │ │ **AAPL**                 │ **AAPL**                            │ │ $**227**.14 +1.42%       │ Apple Inc.                     │ │                      │                                 │ │ **NVDA**                 │ $**227**.14                        │ │ $**182**.31 +3.12%       │ +1.42%                         │ │                      │                                 │ │ **TSLA**                 │       **PRICE** **CHART**               │ │ $**341**.12 -0.82%       │                                 │ │                      │ 1D 1W 1M 3M 6M 1Y              │ │ **MSFT**                 │                                 │ │ $**514**.92 +1.10%       ├─────────────────────────────────┤ │                      │ **TRADE**                           │ │ ...                  │                                 │ └──────────────────────┴─────────────────────────────────┘ ```

---

# 28. Stock List

Every stock row should ideally contain:

```text Company logo/avatar Ticker Company name Current price Change % Sparkline Watchlist button ```

The list must remain dense but readable.

---

# 29. Stock Detail

Selected stock:

```text **AAPL**

Apple Inc. Technology

$**227**.14 +$3.19 +1.42%

Market Open ● ```

Then:

```text Large price chart

1D 1W 1M 3M 6M 1Y ```

Then available metrics:

```text Volume ### Market Cap P/E **52W** High **52W** Low ```

Only use metrics actually provided by the application.

Never invent financial data.

---

# 30. Trade Ticket

Create a clear order ticket:

```text **AAPL**

$**227**.14

**BUY**     **SELL**

Quantity

[-]  10  [+]

### Estimated Value

$2,**271**.40

### Available Cash

$38,**492**

[Review Order] ```

The trade UI should feel:

- deliberate
- trustworthy
- clear
- easy to verify

**BUY** and **SELL** should have obvious semantic distinction.

---

# 31. Watchlist

Promote watchlist into a dedicated page.

Structure:

```text Watchlist

[Search]

**AAPL** Apple $**227**.14 +1.42% sparkline

**NVDA** **NVIDIA** $**182**.31 +3.12% sparkline

**MSFT** Microsoft $**514**.92 +1.10% sparkline

**TSLA** Tesla $**341**.12 -0.82% sparkline ```

Actions:

- remove
- open detail
- buy
- sell

---

# 32. Portfolio — Current

Current Portfolio is a *Portfolio Command Center*.

It contains:

```text ### Cash Balance Investment ### Market Value Total P&L

### Portfolio Insights

Holdings

### Portfolio History

### Position History

Allocation

Transactions

Sell

**CSV** Export ```

Preserve all functionality.

---

# 33. Portfolio — Target

Header:

```text Portfolio

$**104**,**892**.21

+$4,**892**.21 +4.89% ```

Then:

```text ### Portfolio Performance ```

Large chart with:

```text 1D 1W 1M 3M 6M 1Y **ALL** ```

---

# 34. Portfolio Insights

Use compact insight cards:

```text ### Best Performer

**NVDA** +28.42% ```

```text ### Largest Position

Technology 31% ```

```text Diversification

82 / **100** ```

Other useful insights can include:

```text ### Worst Performer ### Largest Gain ### Largest Loss ### Position Weight ```

Do not overwhelm the page.

---

# 35. Portfolio Holdings

Professional financial table:

```text Stock Shares ### Average Price ### Current Price Invested ### Market Value P&L P&L % Allocation ```

Example:

```text **NVDA** 25 $**142**.00 $**182**.31 $3,**550** $4,**557** +$1,**007** +28.4% 31% ```

Include sparklines where useful.

---

# 36. Portfolio Allocation

Maintain horizontal allocation bars.

Example:

```text Technology ████████████████████ 48%

Healthcare ████████ 19%

Finance ███████ 17%

Consumer ██████ 16% ```

Use:

- subtle tracks
- semantic labels
- percentage values
- compact spacing

---

# 37. Analytics

Analytics should become a serious analytical workspace.

Sections:

```text ### Portfolio Performance

### Risk Metrics

Allocation

### Sector Exposure

### Best Performers

### Worst Performers

P&L Analysis

### Trading Activity

```

Potential metrics:

```text Volatility ### Sharpe Ratio ### Maximum Drawdown ```

Only show metrics that the application actually calculates.

Charts must communicate useful information.

---

# 38. Activity / Transactions

Desktop:

```text Activity

Date Type Stock Quantity Price Total Status ```

Example:

```text Today

09:43 **BUY** **AAPL** 40 shares $**227**.14 $9,**085**.60 ```

Mobile:

Use timeline/card layout instead of forcing a wide table.

---

# 39. Profile / Settings

Create:

```text Profile Account Security Preferences Notifications ```

Include:

- avatar
- name
- email
- account details
- security
- preferences
- notifications

Keep settings clean and simple.

---

# 40. Login

Create a premium authentication screen.

Desktop:

```text ┌───────────────────────┬─────────────────────────────┐ │                       │                             │ │      **MARKETFORGE**      │       Welcome back          │ │                       │                             │ │   Practice.           │ Email                       │ │   Analyze.            │ [.....................]     │ │   Improve.            │                             │ │                       │ Password                    │ │   subtle market       │ [.....................]     │ │   visualization       │                             │ │                       │ [ Sign In ]                 │ │                       │                             │ └───────────────────────┴─────────────────────────────┘ ```

Preserve:

- email/password
- Google authentication
- validation
- loading states
- error handling
- redirects

---

# 41. Register

Match Login.

Fields:

```text Name Email Password ### Confirm Password ```

Primary **CTA**:

```text ### Create Account ```

---

# 42. Mobile Design

Mobile must be treated as a first-class experience.

Do **NOT** simply shrink desktop.

---

## Mobile Navigation

Use:

```text Home Markets Portfolio Activity Profile ```

or an equivalent compact navigation.

Sidebar can become:

- drawer
- bottom navigation

---

# 43. Mobile Markets

Target:

```text Markets

[Search]

### Market Overview

**AAPL** $**227**.14 +1.42%

**NVDA** $**182**.31 +3.12%

[Chart]

1D 1W 1M 3M

[Buy] [Sell] ```

Stock details should stack vertically.

Trade controls should remain easy to reach.

---

# 44. Mobile Portfolio

Target:

```text Portfolio

$**104**,**892**

+4.89%

Performance

[Chart]

Insights

Holdings

**AAPL** 40 shares $**227**.14 +19.4%

**NVDA** 25 shares $**182**.31 +28.4% ```

Avoid horizontal scrolling whenever possible.

---

# 45. Loading States

Every data-driven area needs a proper loading state.

Use skeletons for:

- stock rows
- metric cards
- charts
- holdings
- analytics

Avoid simply displaying:

```text Loading... ```

unless appropriate.

---

# 46. Empty States

Create useful empty states.

Example:

```text Your watchlist is empty.

Track stocks you're interested in.

[Explore Markets] ```

Empty states should explain what to do next.

---

# 47. Error States

Errors should be:

- understandable
- non-destructive
- actionable

Example:

```text Unable to load market data.

Please try again.

[Retry] ```

Preserve the existing error handling behavior.

---

# 48. Toasts

Continue using toast notifications for:

- successful trades
- failed trades
- watchlist updates
- errors
- exports

Make their visual appearance consistent with the new design.

---

# 49. Modals

Trading confirmation modals should use:

```text Dark overlay Backdrop blur Centered panel Subtle border Clear title Clear summary Primary action Secondary cancel ```

Avoid oversized dialogs.

---

# 50. Charts

Charts are core product components.

Supported chart types:

```text Line Candlestick Sparkline ### Portfolio History ### Position History Allocation ```

Chart style:

```text Dark background Subtle grid Minimal axes Monospace labels Blue primary Cyan positive Red negative ```

Do not replace charts with decorative graphics.

---

# 51. Chart Controls

Controls should remain compact:

```text 1D 1W 1M 3M 6M 1Y **ALL** ```

Active state:

```text blue border subtle blue background high contrast text ```

Inactive state:

```text dark surface subtle border muted text ```

---

# 52. Sparklines

Sparklines should remain approximately:

```text 80–100px wide 30px high ```

Use them for quick trend context.

Do not make them visually dominant.

---

# 53. Tables

Tables should remain:

- compact
- readable
- dark
- data-dense

Headers:

```text small uppercase muted ```

Rows:

```text small high contrast subtle separators hover state ```

On mobile, convert important tables into cards.

---

# 54. Buttons

Primary:

```text Accent background White text Strong weight Compact height ```

Secondary:

```text Transparent/dark surface Subtle border Muted text ```

Danger:

Use red primarily for destructive/trading sell actions where appropriate.

Do not make every button colorful.

---

# 55. Forms

Inputs:

```text Dark background Subtle border High contrast text Blue focus state 8px-ish radius ```

Labels:

```text Small Muted Clear ```

Errors:

```text Subtle red background Red border Red text ```

---

# 56. Motion

Use motion carefully.

Good uses:

- page transitions
- number count-up
- chart transitions
- stock selection
- hover states
- sidebar transitions
- command palette
- watchlist changes
- modal transitions
- text reveals

Preferred transition speed:

```text **150**–300ms ```

Respect:

```text prefers-reduced-motion ```

Avoid:

- constant particle animation
- excessive bouncing
- giant animated gradients
- distracting effects
- animations on every element

---

# 57. Kokonut UI Strategy

Kokonut UI should be the primary component source.

Use it where appropriate for:

```text Sidebar Navigation Buttons Cards Inputs Dialogs Tabs Dropdowns Command palette Tables Tooltips Loading states ```

Prefer official Kokonut components over manually recreating equivalent components.

---

# 58. Magic UI Strategy

Magic UI should provide premium visual polish.

Use selectively for:

```text Metric cards Spotlight effects Animated surfaces Subtle borders Landing page Loading effects Dashboard polish ```

Do not turn the entire application into a Magic UI showcase.

---

# 59. React Bits Strategy

React Bits should provide interaction and motion.

Use selectively for:

```text Text animation Number animation Hover interactions Micro-interactions Page transitions Background effects Reveal animations ```

Motion must remain professional.

---

# 60. Unified Design System

The application must **NOT** look like:

```text
Kokonut page
- Magic UI page
- React Bits page
```

All three are implementation resources.

The final result must look like:

> One unified MarketForge design system.

---

# 61. Component Architecture

Target structure:

```text src/ ├── components/ │   ├── ui/ │   │   ├── Button │   │   ├── Card │   │   ├── Input │   │   ├── Dialog │   │   ├── Badge │   │   ├── Tabs │   │   ├── Table │   │   └── ... │   │ │   ├── layout/ │   │   ├── AppShell │   │   ├── Sidebar │   │   ├── Topbar │   │   └── MobileNav │   │ │   ├── dashboard/ │   ├── market/ │   ├── portfolio/ │   ├── analytics/ │   ├── activity/ │   └── auth/ │ ├── store/ ├── utils/ ├── assets/ └── styles/ ```

Do not unnecessarily rewrite business logic.

---

# 62. Existing Business Logic

Preserve:

## Authentication

- login
- registration
- Google authentication
- session restoration
- protected routes
- logout
- profile

## Market

- stock fetching
- polling
- search
- filtering
- sorting
- watchlist
- market movers
- stock detail
- history
- charts
- buy
- sell

## Portfolio

- holdings
- P&L
- allocation
- portfolio history
- position history
- sell
- **CSV** export

## Analytics

- existing calculations
- existing data sources

## Transactions

- transaction history
- transaction data
- trade records

Do **NOT** rewrite backend APIs simply for visual changes.

---

# 63. Data Integrity

Never invent financial data.

If a metric is unavailable from the backend:

- omit it
- derive it only if logically valid from existing data
- do not fabricate it for visual purposes

Charts must represent real application data.

---

# 64. Performance

Preserve existing lazy loading.

Avoid:

- unnecessary dependencies
- unnecessary global imports
- excessive re-renders
- duplicated polling
- heavy animation libraries loaded globally
- unnecessarily expensive chart rendering

Use lazy loading for heavy visual components when appropriate.

---

# 65. Accessibility

All redesigned components should support:

- keyboard navigation
- visible focus states
- semantic **HTML**
- accessible labels
- accessible dialogs
- sufficient contrast
- reduced motion
- screen-reader compatibility

Do not sacrifice accessibility for visual polish.

---

# 66. Design Weaknesses To Fix

The redesign should specifically improve the following current issues:

## Navigation

Current navigation works but is basic.

Improve:

- application shell
- hierarchy
- active states
- mobile navigation
- global search

## Information Density

Market and Portfolio contain a lot of information.

Improve:

- grouping
- hierarchy
- spacing
- progressive disclosure

## Terminal Aesthetic

The terminal identity can feel too strong.

Reduce:

- excessive terminal styling
- excessive technical decoration
- unnecessary grid effects

Keep:

- data density
- charts
- monospace financial data
- professional tone

## Component Consistency

Some areas use:

- shared classes
- Tailwind
- inline styles
- custom **CSS**

Move toward a consistent component system.

## Mobile

Create layouts intentionally designed for mobile.

---

# 67. Desired Information Architecture

Target:

```text Dashboard

Markets
    Stock Discovery
    Stock Detail
    Trading

Watchlist

Portfolio
    Holdings
    Performance
    Allocation
    Insights

Analytics

Activity

Settings Profile ```

---

# 68. Target Page Priorities

Design effort should be prioritized:

```text ## Markets ## Portfolio ## Dashboard ## Analytics ## Watchlist ## Activity ## Authentication ## Landing ## Profile / Settings ```

Markets and Portfolio should receive the most visual attention because they contain the core product functionality.

---

# 69. Market UX Principle

The Market experience should follow:

```text
Discover
    ↓
Select
    ↓
Analyze
    ↓
Trade
```

Avoid showing every possible control simultaneously.

---

# 70. Portfolio UX Principle

Portfolio should follow:

```text
How much do I have?
        ↓
How is it performing?
        ↓
What do I own?
        ↓
Where is my money allocated?
        ↓
What should I investigate?
```

---

# 71. Dashboard UX Principle

Dashboard should answer immediately:

```text How much is my portfolio worth?

How much did I gain/loss?

How is it performing?

What stocks should I watch?

What is happening in the market? ```

---

# 72. Analytics UX Principle

Analytics should answer:

```text How am I performing?

How risky is my portfolio?

How diversified am I?

Where is my money allocated?

Which positions are driving performance? ```

---

# 73. Activity UX Principle

Activity should answer:

```text What did I trade?

When?

How much?

At what price?

What happened? ```

---

# 74. Landing Page UX Principle

Landing page should answer:

```text What is MarketForge?

Why should I use it?

What can I do?

How do I start? ```

---

# 75. Design Rules

## Rule 1

Financial information always has visual priority.

## Rule 2

Do not decorate information that doesn't need decoration.

## Rule 3

Use motion to communicate state, not merely for spectacle.

## Rule 4

Use green/red only for financial semantics.

## Rule 5

Keep charts clean.

## Rule 6

Keep tables dense but readable.

## Rule 7

Use whitespace to create hierarchy, not to make the application unnecessarily empty.

## Rule 8

Use one coherent visual language across all pages.

## Rule 9

Do not allow UI libraries to dictate the product's identity.

## Rule 10

Preserve existing functionality while redesigning the presentation layer.

---

# 76. Final Target

The final MarketForge experience should feel like:

> A serious trading application that is powerful enough for analysis but approachable enough for students and beginners.

It should combine:

```text
Financial terminal precision
- Modern SaaS usability
- Premium visual polish
- Excellent responsive UX
```

without becoming:

```text Cyberpunk Neon Gaming Generic SaaS AI dashboard ```

---

# 77. Final Design Statement

MarketForge should evolve from:

> **Dark Professional Financial Terminal**

into:

> **Modern Professional Trading Workspace**

Preserve the current strengths:

- dark theme
- financial colors
- charts
- sparklines
- data density
- monospace numbers
- compact controls
- professional tone

Improve:

- navigation
- hierarchy
- spacing
- responsive layouts
- visual consistency
- stock discovery
- portfolio clarity
- interaction design
- motion
- accessibility
- overall polish

The final UI must feel like **one intentionally designed MarketForge product**, regardless of whether an individual component originated from Kokonut UI, Magic UI, React Bits, or was custom-built.

```

This is the version I'd use as the **canonical `design.md`**. It combines the actual current design language from your repo with the redesign target, so Stitch has both the **starting point and destination** rather than just a generic redesign brief. ```