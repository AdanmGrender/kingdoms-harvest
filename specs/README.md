# specs/

Cada feature con `"sdd": true` en `feature_list.json` obtiene una carpeta
aquí en cuanto sale de `pending`:

```
specs/<feature-name>/
├── requirements.md
├── design.md
├── tasks.md
└── review.md         # lo agrega el reviewer, no existe hasta la revisión
```

`requirements.md`, `design.md` y `tasks.md` los crea el subagente
`spec_author`. `review.md` lo agrega el `reviewer` al emitir su veredicto
(`APPROVED` / `CHANGES_REQUESTED`), una vez el `implementer` termina de
completar `tasks.md`. Ver `docs/specs.md` para el proceso completo. Esta
carpeta empieza vacía — se llena a medida que se procesan features.
