# EA Research Lab — Master Build Specification

> **Purpose:** This file is the single source of truth for an AI coding agent to build the first production-ready version of **EA Research Lab**.
>
> **Primary use case:** Analyze, validate, compare, and manage MetaTrader 5 Expert Advisor optimization and backtest results.
>
> **Important:** MetaTrader 5 remains the execution/backtesting engine. This application is the research and validation layer.

---

## 0. AI BUILD INSTRUCTIONS

You are a senior full-stack engineer, quantitative trading software architect, data engineer, and UX/UI designer.

Your task is to build this application incrementally until the MVP is fully runnable.

### Working rules

1. Do not ask unnecessary questions.
2. Make reasonable engineering decisions when details are unspecified.
3. Keep the project runnable after each major milestone.
4. Do not put the entire application in one file.
5. Use strong typing and modular architecture.
6. Write working code, not placeholder pseudocode.
7. Add tests for parsers, hashing, calculations, and critical API behavior.
8. Run tests and fix errors before considering a milestone complete.
9. Treat all uploaded files as untrusted.
10. Prioritize reproducibility, correctness, and research workflow over visual gimmicks.
11. Do not build a custom trading/backtest engine in the first version.
12. Do not execute uploaded EX5, MQ5, scripts, or arbitrary code.
13. Do not claim that a strategy is safe, profitable, or guaranteed to perform live.
14. The app may calculate research scores, but those scores must be presented as evidence summaries, not predictions.

### Start immediately with this order

1. Create the monorepo.
2. Create the database schema and migrations.
3. Implement MT5 XML import.
4. Implement Stable Set ID generation.
5. Add realistic seed data.
6. Build Optimization Runs.
7. Build Optimization Explorer.
8. Build Candidate Sets.
9. Build Validation Pipeline.
10. Add baseline-vs-validation comparison.
11. Add analytics: Pareto, sensitivity, clusters.
12. Add tests.
13. Add Docker Compose.
14. Add README and developer documentation.
15. Run the complete project locally and fix issues.

---

# 1. PROJECT

## Name

**EA Research Lab**

## Product concept

EA Research Lab is a research workflow system for MetaTrader 5 Expert Advisors.

MetaTrader 5 performs:

- optimization
- backtesting
- real tick simulation
- latency / execution simulation
- forward testing

EA Research Lab performs:

- import
- normalization
- stable identification
- filtering
- comparison
- candidate selection
- validation tracking
- parameter robustness analysis
- clustering
- experiment management
- reporting

### Main workflow

```text
MT5
  ↓
Optimization
  ↓
Export XML / CSV / Optimization Cache metadata
  ↓
EA Research Lab
  ↓
Optimization Explorer
  ↓
Candidate Selection
  ↓
Real Tick Validation
  ↓
Execution Stress Test
  ↓
Out-of-Sample Test
  ↓
Forward Test
  ↓
Parameter Robustness
  ↓
Demo
  ↓
Live Candidate
```

---

# 2. TECH STACK

## Frontend

- Next.js latest stable
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui

## Charts

Preferred:

- Apache ECharts

Alternative when necessary:

- Plotly

## Backend

- Python
- FastAPI
- Pydantic

## Data / Analytics

- Pandas
- NumPy
- SciPy

Optional for clustering:

- scikit-learn
- hdbscan

## Database

- PostgreSQL

## ORM / DB Layer

Preferred:

- SQLAlchemy 2.x
- Alembic migrations

## Local Development

- Docker Compose

## Package Management

Frontend:

- pnpm

Backend:

- uv or pip with requirements/pyproject

---

# 3. REPOSITORY STRUCTURE

Use a monorepo.

```text
ea-research-lab/
├─ apps/
│  ├─ web/
│  │  ├─ app/
│  │  ├─ components/
│  │  ├─ features/
│  │  ├─ hooks/
│  │  ├─ lib/
│  │  ├─ types/
│  │  └─ public/
│  │
│  └─ api/
│     ├─ app/
│     │  ├─ api/
│     │  ├─ core/
│     │  ├─ db/
│     │  ├─ models/
│     │  ├─ schemas/
│     │  ├─ services/
│     │  ├─ parsers/
│     │  ├─ analytics/
│     │  └─ utils/
│     └─ tests/
│
├─ packages/
│  ├─ ui/
│  └─ shared/
│
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ DATABASE.md
│  ├─ MT5_IMPORT_SPEC.md
│  └─ ROADMAP.md
│
├─ docker/
├─ sample-data/
├─ .env.example
├─ docker-compose.yml
├─ README.md
└─ EA_RESEARCH_LAB_SPEC.md
```

---

# 4. DESIGN DIRECTION

Build a professional quantitative trading research dashboard.

## Visual style

- dark-mode optimized
- modern
- minimal
- clean
- information-dense
- professional trading / research terminal feel
- avoid flashy crypto styling
- avoid excessive gradients
- avoid unnecessary animations

## State colors

- Green = Passed
- Yellow = Warning / Pending
- Red = Failed
- Blue = Information / Active
- Gray = Not tested / Disabled

## UX priorities

1. Fast scanning
2. Easy comparison
3. Easy filtering
4. Clear validation state
5. Reproducible research history
6. Stable identifiers independent of MT5 Pass numbers

---

# 5. MAIN NAVIGATION

Sidebar:

```text
Dashboard
Optimization Runs
Optimization Explorer
Candidate Sets
Compare
Validation Pipeline
Parameter Analysis
Charts
Experiments
Imports
Settings
```

---

# 6. MT5 IMPORT

## Supported in MVP

- MT5 Optimization XML
- CSV

## Future

- `.opt` metadata parsing where practical
- HTML backtest reports
- automatic MT5 bridge

## XML fields to recognize

Typical metrics:

```text
Pass
Result
Profit
Expected Payoff
Profit Factor
Recovery Factor
Sharpe Ratio
Custom
Equity DD %
Trades
```

## Dynamic EA parameters

Any column beginning with:

```text
Inp
```

must automatically be treated as an EA input parameter.

Do not hard-code only one Expert Advisor.

Example inputs:

```text
InpTFBias
InpTFZone
InpTFEntry
InpRiskPercent
InpDailyMaxLoss
InpMaxTrades
InpMinRR
InpSwingLookback
InpOBLookback
InpFVGMinPoints
InpRequireCHoCH
InpLondonSession
InpNYSession
InpUseTrailing
InpBreakevenAt
InpTrailAt
InpTrailStep
InpUsePartialTP
InpPartialClosePct
InpPartialTP1_RR
```

## Import metadata

Capture when available:

- EA name
- Symbol
- Timeframe
- Date from
- Date to
- Broker / Server
- Initial deposit
- Leverage
- Optimization method
- Optimization criterion
- Source filename
- File hash
- Import timestamp

---

# 7. SAFE XML PARSING

Uploaded XML is untrusted.

Requirements:

- disable external entity expansion
- prevent XXE
- limit file size
- sanitize filenames
- validate expected structure
- never execute code from uploaded files
- reject malformed inputs gracefully
- show import warnings instead of silently ignoring problems

---

# 8. STABLE SET ID

This is a critical feature.

MT5 Pass numbers are not reliable long-term identifiers.

The application must generate a stable identifier from the complete EA input configuration.

## Example

```text
SET-A84F21C9
```

## Canonicalization rules

1. Extract all EA input parameters.
2. Sort parameter names alphabetically.
3. Normalize booleans to lowercase `true` / `false`.
4. Normalize numeric representations.
5. Normalize timeframe representations.
6. Convert to canonical JSON.
7. Hash using SHA-256.
8. Store the complete hash.
9. Display a short human-friendly prefix.

Example:

```text
stable_set_id = "SET-" + sha256(canonical_json)[:8].upper()
```

## Duplicate behavior

If identical parameters are imported again:

- do not create a duplicate parameter set
- attach the new result/test to the existing Stable Set ID

Example:

```text
SET-A84F21C9
├─ Optimization
├─ Real Tick
├─ 29 ms Latency
├─ Random Delay
├─ OOS
└─ Forward
```

---

# 9. DATABASE MODEL

Create normalized tables.

Minimum entities:

```text
users
expert_advisors
optimization_runs
parameter_sets
parameter_values
optimization_results
backtest_runs
validation_tests
candidate_sets
experiments
import_files
notes
equity_points
```

## Key relationships

- one Expert Advisor has many Optimization Runs
- one Optimization Run has many Optimization Results
- one Optimization Result references one Parameter Set
- one Parameter Set can have many Backtest Runs
- one Backtest Run references exactly one Parameter Set
- one Candidate references one Parameter Set
- one Experiment can contain many Runs, Candidates, and Tests

---

# 10. OPTIMIZATION RUN

Each imported optimization file creates an Optimization Run.

Example:

```text
RUN-20261003-001
```

Store:

- name
- EA
- symbol
- timeframe
- date from
- date to
- broker
- deposit
- leverage
- modelling method
- optimization algorithm
- criterion
- imported result count
- import file reference

Allow manual rename.

Example:

```text
HybridSMC_XAUUSD_M1_Jul-Oct2026_Genetic01
```

---

# 11. OPTIMIZATION EXPLORER

Build a fast advanced table.

## Core columns

```text
Set ID
MT5 Pass
Result
Profit
Profit %
Expected Payoff
Profit Factor
Recovery Factor
Sharpe
Equity DD %
Trades
```

Then append all EA inputs dynamically.

## Table capabilities

- sort
- multi-column sort
- column visibility
- resize columns
- reorder columns
- text search
- saved filters
- pagination or virtualization
- export selected rows
- bulk promote to Candidate
- sticky key columns

## Common filters

```text
Profit > 0
DD <= 10
PF >= 2
Recovery >= 3
Sharpe >= 1
Trades >= 100
```

Allow combined conditions.

Example:

```text
DD <= 10
AND PF >= 3
AND Trades >= 100
AND Profit > 1000
```

---

# 12. CANDIDATE SETS

Users can promote optimization results into Candidate Sets.

Example:

```text
SET-A84F21C9
SET-B32D11F0
SET-C719FA22
```

## Candidate card

Display:

- Stable Set ID
- key parameters
- optimization metrics
- validation progress
- notes
- tags

## Candidate metrics

- Profit
- Profit %
- Drawdown
- Profit Factor
- Recovery Factor
- Sharpe
- Trades
- Win rate when available

## Validation state

```text
Optimization        PASSED
Real Tick           PASSED
Latency Test        PASSED
Random Delay        PENDING
Out-of-Sample       NOT TESTED
Forward             NOT TESTED
Parameter Robust    NOT TESTED
Demo                NOT TESTED
```

---

# 13. VALIDATION PIPELINE

Pipeline:

```text
Optimization
↓
Real Tick
↓
Execution Stress
↓
Out-of-Sample
↓
Forward
↓
Parameter Robustness
↓
Demo
↓
Live Candidate
```

Each stage stores:

- status
- date
- test settings
- metrics
- comparison to baseline
- notes
- source import

Statuses:

```text
NOT_TESTED
RUNNING
PASSED
WARNING
FAILED
```

Do not automatically say that a strategy is safe.

---

# 14. BACKTEST RUN IMPORT

Allow importing single-test results and attaching them to a Stable Set ID.

Test types:

```text
OPTIMIZATION
REAL_TICK
LATENCY
RANDOM_DELAY
OUT_OF_SAMPLE
FORWARD
DEMO
```

## Store metrics

- Net Profit
- Gross Profit
- Gross Loss
- Balance DD
- Equity DD
- Profit Factor
- Expected Payoff
- Recovery Factor
- Sharpe Ratio
- Total Trades
- Profit Trades
- Loss Trades
- Win Rate
- Maximum Consecutive Wins
- Maximum Consecutive Losses
- History Quality
- Tick Count
- Delay
- Modelling Method
- Date from
- Date to
- Deposit
- Leverage

---

# 15. BASELINE VS VALIDATION

Every Candidate must support comparison against a baseline.

Example:

| Metric | Baseline | Real Tick | Change |
|---|---:|---:|---:|
| Profit | 1388.66 | 1277.83 | -7.99% |
| DD | 2.92% | 3.39% | +0.47 pp |
| PF | 6.00 | 5.48 | -8.7% |
| Trades | 111 | 104 | -6.3% |
| Sharpe | 25.87 | 26.50 | +2.4% |

## Default warning thresholds

Make configurable.

Suggested defaults:

```text
Profit degradation > 30%
Drawdown increase > 2x
Profit Factor < 1.5
Trades change > 25%
```

---

# 16. PARAMETER ROBUSTNESS

Analyze whether performance exists across nearby parameter values.

Example:

```text
SwingLookback
33 = weak
34 = good
35 = good
36 = excellent
37 = good
38 = good
```

This suggests a plateau.

But:

```text
35 = weak
36 = excellent
37 = weak
```

suggests parameter sensitivity / possible overfitting risk.

Do not claim overfitting solely from this one signal.

## Visualizations

- Parameter vs Profit
- Parameter vs DD
- Parameter vs PF
- Parameter vs Sharpe
- 2D heatmaps

Example heatmap:

```text
SwingLookback × OBLookback
```

Selectable metric:

```text
Profit
Drawdown
Profit Factor
Recovery
Sharpe
```

---

# 17. PARAMETER CLUSTERING

Detect groups of similar high-performing parameter sets.

Possible algorithms:

- DBSCAN
- HDBSCAN
- hierarchical clustering

Support numeric and categorical parameters.

Cluster metrics:

- member count
- median profit
- median DD
- median PF
- median trades
- median Sharpe
- worst DD
- profitable-member ratio
- parameter ranges

---

# 18. DUPLICATE / NEAR-DUPLICATE DETECTION

Detect:

1. exact duplicate parameter sets
2. near-duplicate parameter sets
3. different inputs producing identical outputs

If inputs differ but metrics/trades are identical, show a cautious hint such as:

> This parameter may not have been activated during this test period.

Do not state that the parameter is globally useless.

---

# 19. PARETO FRONT

Create Pareto analysis.

Maximize:

- Profit
- Profit Factor
- Recovery
- Sharpe

Minimize:

- Drawdown

Required chart:

```text
Profit vs Drawdown
```

Highlight Pareto-efficient candidates.

Clicking a point opens the Stable Set detail.

---

# 20. ROBUSTNESS SCORE

Create an internal configurable research score from 0–100.

It must be described as:

> A summary of validation evidence, not a forecast of future profitability.

Possible components:

- Real Tick Stability
- Execution Stability
- OOS Stability
- Forward Stability
- Parameter Plateau
- Sample Size
- Drawdown Stability

Formula must be configurable and component breakdown visible.

---

# 21. COMPARE PAGE

Allow selecting 2–10 Stable Sets.

Compare:

- parameters
- profit
- DD
- PF
- recovery
- Sharpe
- trades
- validation results
- validation degradation
- equity curves when available

---

# 22. EQUITY CURVES

Database must support:

```text
timestamp
balance
equity
drawdown
```

Allow overlays for:

```text
Optimization
Real Tick
Random Delay
OOS
Forward
```

---

# 23. EXPERIMENT MANAGEMENT

Create research Experiments.

Example:

```text
EXP-001
HybridSMC XAUUSD M1
```

Attach:

- Optimization Runs
- Candidate Sets
- Validation Tests
- Notes
- Charts

Goal: reproducible research history.

---

# 24. IMPORT HISTORY

Store:

- filename
- file hash
- import timestamp
- import type
- related run
- number of records
- errors
- warnings

Prevent accidental duplicate imports.

---

# 25. DASHBOARD

Show:

- Optimization Results
- Profitable Results
- DD < threshold
- PF > threshold
- Trades >= threshold
- Robust Clusters
- Candidates
- Real Tick Passed
- Stress Test Passed
- OOS Passed
- Forward Passed
- recent imports
- recent experiments
- latest validation activity

Charts:

- Profit vs Drawdown
- Profit Factor vs Trades
- Sharpe vs Drawdown
- Validation funnel

---

# 26. SAMPLE DATA

Seed a realistic candidate.

```text
Initial Deposit = 3000
```

Optimization:

```text
Profit = 1388.66
DD = 2.92%
PF = 6.00
Recovery = 12.13
Sharpe = 25.87
Trades = 111
```

Real Tick:

```text
Profit = 1277.83
DD = 3.39%
PF = 5.48
Recovery = 10.83
Sharpe = 26.50
Trades = 104
```

29 ms Latency:

```text
Profit = 1389.14
DD = 3.38%
PF = 6.10
Recovery = 13.00
Sharpe = 26.57
Trades = 105
```

Parameters:

```text
TFBias = M3
TFZone = H4
TFEntry = M6
RiskPercent = 0.3
MinRR = 1.5
SwingLookback = 36
```

---

# 27. API DESIGN

Suggested REST endpoints:

```text
POST /api/import/mt5/xml
POST /api/import/mt5/csv

GET /api/imports

GET /api/optimization-runs
GET /api/optimization-runs/{id}

GET /api/sets
GET /api/sets/{id}
GET /api/sets/{id}/tests
GET /api/sets/{id}/similar

POST /api/candidates
GET /api/candidates

GET /api/compare

GET /api/analytics/pareto
GET /api/analytics/clusters
GET /api/analytics/parameter-sensitivity

GET /api/experiments
POST /api/experiments
```

Use pagination for large datasets.

---

# 28. IMPORTANT CALCULATIONS

Profit Percentage:

```text
Profit / Initial Deposit × 100
```

Validation degradation:

```text
(new - baseline) / abs(baseline)
```

For drawdown also calculate percentage-point change:

```text
New DD - Baseline DD
```

Stable Set Hash:

```text
SHA256(canonical normalized EA input JSON)
```

---

# 29. PERFORMANCE REQUIREMENTS

Optimization imports may contain 10,000–100,000+ rows.

Requirements:

- server-side pagination
- indexed metric columns
- efficient filtering
- background jobs for heavy analytics
- virtualized frontend table
- do not load full dataset into browser memory

---

# 30. FRONTEND PAGES

```text
/dashboard
/runs
/runs/[id]
/explorer
/sets/[id]
/candidates
/compare
/analysis/parameters
/analysis/clusters
/experiments
/imports
/settings
```

Set detail tabs:

```text
Overview
Parameters
Metrics
Validation
Charts
Similar Sets
Notes
```

---

# 31. MVP PHASES

## Phase 1 — Foundation

Build:

- monorepo
- Docker Compose
- PostgreSQL
- migrations
- FastAPI
- Next.js
- MT5 XML importer
- Stable Set ID
- Optimization Runs
- Optimization Explorer
- filters
- Candidate Sets

Acceptance criteria:

1. Docker Compose boots
2. MT5 XML imports
3. run metadata is visible
4. thousands of rows can be browsed
5. filtering/sorting works
6. Stable Set IDs appear
7. candidate promotion works

## Phase 2 — Validation

Build:

- Backtest Runs
- validation stages
- baseline comparison
- Real Tick comparison
- latency comparison
- OOS comparison
- Forward comparison

## Phase 3 — Analytics

Build:

- Pareto front
- parameter sensitivity
- heatmaps
- duplicate detection
- cluster detection

## Phase 4 — Research Workflow

Build:

- experiments
- notes
- equity curves
- configurable robustness score
- advanced reports

---

# 32. TESTING

Required tests:

Parser:
- valid MT5 XML
- missing metadata
- unknown Inp fields
- malformed XML
- duplicate import
- numeric parsing
- boolean parsing
- timeframe parsing

Stable ID:
- parameter order does not change hash
- numeric formatting does not change hash
- boolean formatting does not change hash
- actual parameter change does change hash

Metrics:
- profit percentage
- relative degradation
- drawdown percentage-point change
- Pareto detection

API:
- import
- runs
- filtering
- candidates
- set detail
- validation attachment

---

# 33. README REQUIREMENTS

README must explain:

1. What EA Research Lab is
2. Architecture
3. Prerequisites
4. Local installation
5. Docker Compose
6. Environment variables
7. Database migration
8. Seed data
9. Running frontend
10. Running backend
11. Importing MT5 XML
12. Stable Set IDs
13. Validation workflow
14. Running tests

---

# 34. ENVIRONMENT VARIABLES

Provide `.env.example`.

```env
POSTGRES_DB=ea_research_lab
POSTGRES_USER=ea_lab
POSTGRES_PASSWORD=change_me

DATABASE_URL=postgresql+psycopg://ea_lab:change_me@db:5432/ea_research_lab

NEXT_PUBLIC_API_URL=http://localhost:8000
API_CORS_ORIGINS=http://localhost:3000

MAX_UPLOAD_MB=100
```

---

# 35. DEFINITION OF DONE FOR MVP

MVP is complete only when:

- Docker Compose boots successfully
- PostgreSQL initializes
- migrations work
- FastAPI is reachable
- Next.js is reachable
- sample MT5 XML can be imported
- imported run metadata is visible
- optimization results render in Explorer
- dynamic `Inp*` parameters are visible
- Stable Set IDs are deterministic
- filters work
- sort works
- candidate promotion works
- tests pass
- README works from a clean environment

---

# 36. FUTURE FEATURES — DO NOT BUILD YET

Keep architecture extensible for:

- automatic MT5 terminal bridge
- `.set` file generation
- queued MT5 validation runs
- local MT5 worker
- automatic Real Tick validation
- Monte Carlo simulation
- walk-forward analysis
- cross-broker comparison
- multi-symbol validation
- portfolio-level EA analysis
- prop-firm rule simulator
- strategy version tracking
- AI research assistant

Do not implement these until MVP is stable.

---

# 37. FINAL EXECUTION INSTRUCTION

Start building now.

Do not only describe what should be built.

Create the actual files, code, migrations, tests, Docker configuration, and documentation.

At each milestone:

1. implement
2. run
3. test
4. fix
5. continue

The first usable milestone must support:

```text
MT5 XML
→ Import
→ Optimization Run
→ Stable Set IDs
→ Optimization Explorer
→ Filter
→ Candidate Selection
```

Once this flow works end-to-end, continue to Phase 2.
