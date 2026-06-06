# Source Safety Audit

- Source folders inspected:
  - C:\Program Files (x86)\Johnson Controls\UI Offline\API\Templates
  - C:\ProgramData\Johnson Controls\
- Repository write scope confirmed:
  - writes are limited to the repo-local workspace and generated output folders
- Suspicious modified files:
  - src/lib/supabase/middleware.ts was already modified in the workspace before this bulk import pass
  - no writes were made to Program Files or ProgramData during this pass

## Newest inspected source files
- AHUTemplates/BlowerCoilUnit.html (2026-01-05T13:20:46.000Z)
- AHUTemplates/HeatRecoveryUnit.html (2026-01-05T13:20:46.000Z)
- AHUTemplates/Hundred_Per_OADualDuct.html (2026-01-05T13:20:46.000Z)
- AHUTemplates/Hundred_Per_OASingleDuct.html (2026-01-05T13:20:46.000Z)
- AHUTemplates/MakeupAirUnit.html (2026-01-05T13:20:46.000Z)
- AHUTemplates/MixedAirDualDuct.html (2026-01-05T13:20:46.000Z)
- AHUTemplates/MixedAirSingleDuct.html (2026-01-05T13:20:46.000Z)
- AHUTemplates/MultiZoneMixedAirDualDuct.html (2026-01-05T13:20:46.000Z)
- AHUTemplates/PackagedRoofTopUnit.html (2026-01-05T13:20:46.000Z)
- AHUTemplates/RoofTopUnit1.html (2026-01-05T13:20:46.000Z)
