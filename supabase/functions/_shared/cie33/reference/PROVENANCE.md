# CIE 3.3 reference subset

Source: user-supplied `CIE_v3_3_Canonical_Set(2).zip` (identical to `(3).zip`).
Archive SHA-256: `6b275091d05bac7decdef351d03234e3b46266bc1e1f5f0fae994492b83745da`.
Original reference-kernel version: 3.3.0; all 44 original tests passed before adaptation.

This subset implements question validation/issuance, answer binding, deterministic routing, witness compilation/commit and safety. Other upstream capabilities are not claimed.

Local changes:
- Fix the upstream TypeScript indexed access `QuestionPlan["operation"]` to `QuestionPlan["operations"][number]`.
- Make the witness return type's present/missing discriminated union explicit; canonical wire values and hashes are unchanged.
- Extend the registry under the distinct pin `3.3.0-vizzhy-foundation.1` for the authored Vizzhy Foundation templates. Existing concepts and four locked sentinels retain their wording and meaning.
- Application-side strict payload validation, authenticated persistence, concurrency and append-only corrections live outside this reference directory.

The Foundation profile is an application adaptation of the supplied v3 subjective-sensing doctrine. It is not a validated diagnostic scale or a claim of full reference-profile conformance. Neither the original 44 tests nor application tests establish clinical validity.
