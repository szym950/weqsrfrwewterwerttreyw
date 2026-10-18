<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep menu content in a browser-safe data module; dish photos live in `public/` and are referenced by root-relative paths like `/Parma.png` (no `public/` prefix, no spaces in filenames) so new dishes can be added without changing the page layout.
- Use the home route for the menu with in-memory category/search and cart state; accessible dialogs hold dish details and cart quantities, and checkout must not be presented until real pricing and an order flow are supplied.
- Define all menu visual styles and semantic tokens in the global stylesheet to keep the catalogue and future dishes visually consistent.
- Site-wide info (contact details, delivery zones, ordering-platform and social links) lives in `src/lib/site.ts` with explicit "do uzupełnienia" placeholders; never invent business data — fill in real values only when the user supplies them.
- "Najczęściej wybierane" is populated from shared add-to-cart counts stored in the database (dish_counts table, incremented via the increment_dish_count function) so all visitors contribute.
- Shared pages (Dostawa, O nas, Kontakt) use `PageShell` + `SiteFooter`; keep new pages in the existing dark style with classes defined in `src/styles.css`.
