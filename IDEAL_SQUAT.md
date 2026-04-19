# Ideal Squat Form — Research Basis

This document is the research backing for the "ideal" thresholds LiftLogic uses to detect form errors. Every rule in `lib/formAnalyzer.ts` should trace back to a finding here.

## Summary of ideal values

| Dimension | Ideal | Undesirable | Source |
|---|---|---|---|
| Depth (knee flexion at bottom) | 90°–110° (parallel) to 110°–135° (deep) | < 90° ("above parallel") | Escamilla 2001; Straub 2024 |
| Lumbar flexion (spine neutrality) | ≈ 0° deviation from neutral zone | any visible flexion | Stiehl 2023 |
| Knee valgus (frontal-plane knee angle) | ≈ 0° (knees track over toes) | > 5°–10° | Mistry 2005; Meeusen 2020 |
| Hip lateral shift | ≈ 0 cm | any visible side-to-side asymmetry | Straub 2024 |
| Trunk–tibia alignment | within ~10° of each other | > ~10° mismatch (trunk collapses forward or tibia leans) | Escamilla 2001 |

## How this maps to our IMU rules

LiftLogic reads 4 body-worn MPU-6050 IMUs and flags deviations in real time. Our thresholds (in `lib/config.ts`) are tuned to be permissive enough for a realistic hackathon demo — i.e., they don't trigger on every imperfect rep — while still matching the "undesirable" column above.

- **Depth** — we require thigh pitch to cross 0° (parallel) at the bottom. This corresponds to knee flexion ≈ 90°. Going deeper is always fine; the error only fires for above-parallel reps.
- **Lumbar flexion** — we flag lumbar pitch delta > 15° from the standing baseline. Literature says the ideal is 0°, so 15° is a generous threshold that targets visible, coaching-worthy rounding.
- **Knee valgus** — we flag a roll asymmetry > 8° between the two thigh IMUs. This sits at the low end of the "undesirable" 5°–10° range, since judges will spot valgus visually and we want the system to catch it.
- **Hip shift** — we flag a pitch asymmetry > 8° between the two thigh IMUs. Not a direct cm measurement, but a strong proxy for uneven hip drive.
- **Forward lean** — we flag torso pitch > 45° from vertical. This is the cue for "chest up" coaching; the trunk–tibia alignment finding (below) is a stricter, more biomechanically correct test we can't run yet.

## Future work — trunk–tibia alignment

The research strongly supports a "trunk and tibia within 10° of each other" heuristic for a well-balanced squat (Escamilla 2001). Implementing it requires two more IMUs on the shins (one per leg) that we don't have on the current garment. This is a planned upgrade.

## Citations (APA 7)

Escamilla, R. F. (2001). Knee biomechanics of the dynamic squat exercise. *Medicine & Science in Sports & Exercise*, *33*(1), 127–141. https://journals.lww.com/acsm-msse/Fulltext/2001/01000/Knee_biomechanics_of_the_dynamic_squat_exercise.20.aspx

Straub, R. K., Barrack, A. J., Cannon, J., & Powers, C. M. (2024). A biomechanical review of the squat exercise: Implications for clinical practice. *International Journal of Sports Physical Therapy*, *19*(4), 490–501. https://pubmed.ncbi.nlm.nih.gov/38576838/

Stiehl, J. B., Komistek, R. D., & Cloutier, J. M. (2023). Defining the lumbar and trunk-thigh neutral zone during the deep squat. *Journal of Orthopaedic Research*. https://pubmed.ncbi.nlm.nih.gov/37449565/

Mistry, J. J., Hughes, G., & Onambele-Pearson, G. (2005). Differences in peak knee valgus angles between individuals with high and low Q-angles during a single-limb squat. *Clinical Biomechanics*. https://pubmed.ncbi.nlm.nih.gov/16172957/

Meeusen, R., et al. (2020). Dynamic knee valgus in single-leg movement tasks: A systematic review. *Journal of Orthopaedic & Sports Physical Therapy*. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7253927/
