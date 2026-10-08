:::warning Draft plan
This is the plan as it stands at the start. It will change as the reading progresses. Anything decided properly goes on the **Decisions** page, marked as prespecified if it was settled before seeing outcome data.
:::

## Data

UK Biobank baseline Olink plasma proteomics, linked to later diagnoses. See the [Data policy](/docs/data-policy): no participant-level data is stored on this site.

## Models compared

| Model | Predictors |
|---|---|
| **M1** | age + sex |
| **M2** | M1 + NfL (Olink NEFL) |
| **M3** | M2 + selected inflammatory proteins |

## How they are fitted and checked

Penalised Cox regression, with repeated nested cross-validation.

## The main comparison

**M3 against M2**: the paired change in time-dependent AUC, together with calibration.

## Secondary analyses

- Adding GFAP.
- Adding prespecified risk factors for dementia from any cause.

## Sensitivity analyses

- Excluding diagnoses made within 2 years, and within 5 years, of baseline.
- Looking at participants with markedly raised CRP.
- Adjusting for baseline depression.

## Not yet worked out

See [Things to decide](/docs/things-to-decide).
