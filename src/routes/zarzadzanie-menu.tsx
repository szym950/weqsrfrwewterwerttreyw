import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { canEditMenu, isStaffRole } from "@/lib/staff-roles";

type MenuCategory = Tables<"menu_categories">;
type MenuDish = Tables<"menu_dishes">;

type DishForm = {
  name: string;
  categoryId: string;
  price: string;
  ingredients: string;
  station: "kitchen" | "bar";
  imageUrl: string;
  available: boolean;
};

const emptyDishForm: DishForm = {
  name: "",
  categoryId: "",
  price: "",
  ingredients: "",
  station: "kitchen",
  imageUrl: "",
  available: true,
};

export const Route = createFileRoute("/zarzadzanie-menu")({
  head: () => ({
    meta: [
      { title: "Zarządzanie menu — Wake Up House" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MenuManager,
});

function MenuManager() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishForm, setDishForm] = useState<DishForm>(emptyDishForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError;
        if (!active) return;
        setUserId(data.session?.user.id ?? null);
        setEmail(data.session?.user.email ?? "");
      })
      .catch((sessionError: unknown) => {
        console.error("Nie udało się odczytać sesji panelu menu.", sessionError);
        if (active) setError("Nie udało się sprawdzić logowania. Odśwież stronę.");
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? "");
      setAuthorized(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setAuthorized(false);
      setCategories([]);
      setDishes([]);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      const { data: membership, error: membershipError } = await supabase
        .from("staff_members")
        .select("user_id, role")
        .eq("user_id", userId)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!active) return;
      const role = membership && isStaffRole(membership.role) ? membership.role : null;
      if (!canEditMenu(role)) {
        setAuthorized(false);
        setError("To konto nie ma uprawnień administratora ani edytora menu.");
        return;
      }

      const [categoryResult, dishResult] = await Promise.all([
        supabase.from("menu_categories").select("*").order("sort_order").order("name"),
        supabase.from("menu_dishes").select("*").order("sort_order").order("name"),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (dishResult.error) throw dishResult.error;
      if (!active) return;
      setCategories(categoryResult.data);
      setDishes(dishResult.data);
      setCategoryDrafts(
        Object.fromEntries(categoryResult.data.map((category) => [category.id, category.name])),
      );
      setDishForm((current) => ({
        ...current,
        categoryId: current.categoryId || categoryResult.data[0]?.id || "",
      }));
      setAuthorized(true);
    })()
      .catch((loadError: unknown) => {
        console.error("Nie udało się załadować panelu menu.", loadError);
        if (active) setError("Nie udało się pobrać menu. Spróbuj ponownie.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const refreshMenu = async () => {
    const [categoryResult, dishResult] = await Promise.all([
      supabase.from("menu_categories").select("*").order("sort_order").order("name"),
      supabase.from("menu_dishes").select("*").order("sort_order").order("name"),
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (dishResult.error) throw dishResult.error;
    setCategories(categoryResult.data);
    setDishes(dishResult.data);
  };

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password,
    });
    if (signInError) setError("Nie udało się zalogować. Sprawdź e-mail i hasło pracownika.");
    setBusy(false);
  };

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error("Nie udało się wylogować z panelu menu.", signOutError);
      setError("Nie udało się wylogować. Spróbuj ponownie.");
    }
  };

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("menu_categories").insert({
        name,
        sort_order: categories.length + 1,
      });
      if (insertError) throw insertError;
      setNewCategoryName("");
      setNotice("Dodano kategorię.");
      await refreshMenu();
    } catch (saveError) {
      console.error("Nie udało się dodać kategorii menu.", saveError);
      setError("Nie udało się dodać kategorii. Sprawdź, czy taka nazwa już istnieje.");
    } finally {
      setBusy(false);
    }
  };

  const updateCategory = async (category: MenuCategory) => {
    const name = categoryDrafts[category.id]?.trim();
    if (!name) {
      setError("Nazwa kategorii nie może być pusta.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("menu_categories")
        .update({ name })
        .eq("id", category.id);
      if (updateError) throw updateError;
      setNotice("Zapisano kategorię.");
      await refreshMenu();
    } catch (saveError) {
      console.error("Nie udało się zapisać kategorii menu.", saveError);
      setError("Nie udało się zapisać kategorii. Sprawdź, czy taka nazwa już istnieje.");
    } finally {
      setBusy(false);
    }
  };

  const setCategoryVisibility = async (category: MenuCategory) => {
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("menu_categories")
        .update({ is_active: !category.is_active })
        .eq("id", category.id);
      if (updateError) throw updateError;
      setNotice(
        category.is_active ? "Ukryto kategorię na stronie." : "Przywrócono kategorię na stronie.",
      );
      await refreshMenu();
    } catch (saveError) {
      console.error("Nie udało się zmienić widoczności kategorii.", saveError);
      setError("Nie udało się zmienić widoczności kategorii.");
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async (category: MenuCategory) => {
    if (dishes.some((dish) => dish.category_id === category.id)) {
      setError("Najpierw przenieś albo usuń dania z tej kategorii.");
      return;
    }
    if (!window.confirm(`Usunąć kategorię „${category.name}”?`)) return;
    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await supabase
        .from("menu_categories")
        .delete()
        .eq("id", category.id);
      if (deleteError) throw deleteError;
      setNotice("Usunięto kategorię.");
      await refreshMenu();
    } catch (saveError) {
      console.error("Nie udało się usunąć kategorii menu.", saveError);
      setError("Nie udało się usunąć kategorii.");
    } finally {
      setBusy(false);
    }
  };

  const editDish = (dish: MenuDish) => {
    setEditingDishId(dish.id);
    setDishForm({
      name: dish.name,
      categoryId: dish.category_id,
      price: dish.price_pln === null ? "" : String(dish.price_pln),
      ingredients: dish.ingredients.join("\n"),
      station: dish.station === "bar" ? "bar" : "kitchen",
      imageUrl: dish.image_url,
      available: dish.is_available,
    });
    setPhoto(null);
    document.getElementById("dish-editor")?.scrollIntoView({ behavior: "smooth" });
  };

  const saveDish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = dishForm.name.trim();
    const priceInput = dishForm.price.trim().replace(",", ".");
    const ingredients = dishForm.ingredients
      .split("\n")
      .map((ingredient) => ingredient.trim())
      .filter(Boolean);
    if (!name || !dishForm.categoryId || !ingredients.length) {
      setError("Uzupełnij nazwę, kategorię i co najmniej jeden składnik.");
      return;
    }
    if (priceInput && !/^\d+(?:\.\d{1,2})?$/.test(priceInput)) {
      setError("Podaj cenę w złotych, np. 29,90.");
      return;
    }
    if (
      photo &&
      (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5_242_880)
    ) {
      setError("Zdjęcie musi być JPG, PNG lub WebP i mieć maksymalnie 5 MB.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    let uploadedPath: string | null = null;
    try {
      let imageUrl = dishForm.imageUrl;
      if (photo) {
        const extension = photo.type === "image/jpeg" ? "jpg" : photo.type.split("/")[1];
        const path = `menu/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(path, photo, { contentType: photo.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPath = path;
        imageUrl = supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
      }

      const values = {
        name,
        category_id: dishForm.categoryId,
        price_pln: priceInput ? Number(priceInput) : null,
        ingredients,
        station: dishForm.station,
        image_url: imageUrl,
        is_available: dishForm.available,
      };
      const result = editingDishId
        ? await supabase.from("menu_dishes").update(values).eq("id", editingDishId)
        : await supabase.from("menu_dishes").insert({
            ...values,
            sort_order: dishes.length + 1,
          });
      if (result.error) throw result.error;
      setNotice(editingDishId ? "Zapisano zmiany dania." : "Dodano danie do menu.");
      setEditingDishId(null);
      setDishForm({ ...emptyDishForm, categoryId: categories[0]?.id ?? "" });
      setPhoto(null);
      await refreshMenu();
    } catch (saveError) {
      console.error("Nie udało się zapisać dania.", saveError);
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from("menu-images")
          .remove([uploadedPath]);
        if (cleanupError)
          console.error("Nie udało się usunąć zdjęcia po nieudanym zapisie.", cleanupError);
      }
      setError("Nie udało się zapisać dania. Sprawdź nazwę, połączenie i uprawnienia.");
    } finally {
      setBusy(false);
    }
  };

  const deleteDish = async (dish: MenuDish) => {
    if (!window.confirm(`Usunąć „${dish.name}” z menu?`)) return;
    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await supabase.from("menu_dishes").delete().eq("id", dish.id);
      if (deleteError) throw deleteError;
      setNotice("Usunięto danie z menu.");
      if (editingDishId === dish.id) {
        setEditingDishId(null);
        setDishForm({ ...emptyDishForm, categoryId: categories[0]?.id ?? "" });
      }
      await refreshMenu();
    } catch (deleteError) {
      console.error("Nie udało się usunąć dania.", deleteError);
      setError("Nie udało się usunąć dania.");
    } finally {
      setBusy(false);
    }
  };

  const toggleDishAvailability = async (dish: MenuDish) => {
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("menu_dishes")
        .update({ is_available: !dish.is_available })
        .eq("id", dish.id);
      if (updateError) throw updateError;
      setNotice(dish.is_available ? "Ukryto danie na stronie." : "Przywrócono danie na stronie.");
      await refreshMenu();
    } catch (updateError) {
      console.error("Nie udało się zmienić dostępności dania.", updateError);
      setError("Nie udało się zmienić dostępności dania.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <ManagerFrame>
        <p role="status">Sprawdzam logowanie…</p>
      </ManagerFrame>
    );
  }

  if (!userId) {
    return (
      <ManagerFrame>
        <div className="menu-manager-card">
          <h1>Panel zarządzania menu</h1>
          <p>Zaloguj się kontem pracownika utworzonym w Supabase.</p>
          {error ? (
            <p className="menu-manager-error" role="alert">
              {error}
            </p>
          ) : null}
          <form className="menu-manager-form" onSubmit={(event) => void signIn(event)}>
            <label>
              E-mail
              <input
                autoComplete="username"
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Hasło
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Logowanie…" : "Zaloguj się"}
            </Button>
          </form>
        </div>
      </ManagerFrame>
    );
  }

  return (
    <ManagerFrame>
      <header className="menu-manager-header">
        <div>
          <p className="eyebrow">WAKE UP HOUSE · PANEL LOKALU</p>
          <h1>Zarządzanie menu</h1>
          <p>Zalogowano jako {email}</p>
        </div>
        <div className="menu-manager-actions">
          <Link to="/" className="delivery-more">
            Zobacz stronę
          </Link>
          <Button variant="outline" onClick={() => void signOut()}>
            Wyloguj
          </Button>
        </div>
      </header>
      {error ? (
        <p className="menu-manager-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="menu-manager-notice" role="status">
          {notice}
        </p>
      ) : null}
      {loading ? <p role="status">Ładowanie menu…</p> : null}
      {authorized ? (
        <>
          <section className="menu-manager-card">
            <h2>Kategorie</h2>
            <form
              className="menu-manager-category-add"
              onSubmit={(event) => void addCategory(event)}
            >
              <input
                aria-label="Nazwa nowej kategorii"
                placeholder="Nowa kategoria"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                maxLength={80}
                required
              />
              <Button type="submit" disabled={busy}>
                Dodaj kategorię
              </Button>
            </form>
            <div className="menu-manager-category-list">
              {categories.map((category) => (
                <div className="menu-manager-category" key={category.id}>
                  <input
                    aria-label={`Nazwa kategorii ${category.name}`}
                    value={categoryDrafts[category.id] ?? category.name}
                    onChange={(event) =>
                      setCategoryDrafts((current) => ({
                        ...current,
                        [category.id]: event.target.value,
                      }))
                    }
                    maxLength={80}
                  />
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void updateCategory(category)}
                  >
                    Zapisz
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void setCategoryVisibility(category)}
                  >
                    {category.is_active ? "Ukryj" : "Pokaż"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void deleteCategory(category)}
                  >
                    Usuń
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="menu-manager-card" id="dish-editor">
            <h2>{editingDishId ? "Edytuj danie" : "Dodaj danie"}</h2>
            {!categories.length ? (
              <p>Najpierw utwórz kategorię.</p>
            ) : (
              <form
                className="menu-manager-form menu-manager-dish-form"
                onSubmit={(event) => void saveDish(event)}
              >
                <label>
                  Nazwa
                  <input
                    value={dishForm.name}
                    onChange={(event) =>
                      setDishForm((form) => ({ ...form, name: event.target.value }))
                    }
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  Kategoria
                  <select
                    value={dishForm.categoryId}
                    onChange={(event) =>
                      setDishForm((form) => ({ ...form, categoryId: event.target.value }))
                    }
                    required
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cena w zł (puste = bez ceny)
                  <input
                    inputMode="decimal"
                    placeholder="np. 29,90"
                    value={dishForm.price}
                    onChange={(event) =>
                      setDishForm((form) => ({ ...form, price: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Stanowisko
                  <select
                    value={dishForm.station}
                    onChange={(event) =>
                      setDishForm((form) => ({
                        ...form,
                        station: event.target.value === "bar" ? "bar" : "kitchen",
                      }))
                    }
                  >
                    <option value="kitchen">Kuchnia</option>
                    <option value="bar">Bar</option>
                  </select>
                </label>
                <label className="menu-manager-wide">
                  Składniki (każdy w osobnej linii)
                  <textarea
                    rows={5}
                    value={dishForm.ingredients}
                    onChange={(event) =>
                      setDishForm((form) => ({ ...form, ingredients: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="menu-manager-wide">
                  Zdjęcie (JPG, PNG lub WebP, maks. 5 MB)
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    type="file"
                    onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                  />
                  {photo ? (
                    <span>Wybrane: {photo.name}</span>
                  ) : dishForm.imageUrl ? (
                    <span>
                      Obecne zdjęcie:{" "}
                      <a href={dishForm.imageUrl} target="_blank" rel="noreferrer">
                        podgląd
                      </a>
                    </span>
                  ) : (
                    <span>Brak zdjęcia — można zapisać danie bez niego.</span>
                  )}
                </label>
                <label className="menu-manager-checkbox">
                  <input
                    type="checkbox"
                    checked={dishForm.available}
                    onChange={(event) =>
                      setDishForm((form) => ({ ...form, available: event.target.checked }))
                    }
                  />
                  Pokazuj danie na stronie
                </label>
                <div className="menu-manager-wide menu-manager-actions">
                  <Button type="submit" disabled={busy}>
                    {busy ? "Zapisywanie…" : editingDishId ? "Zapisz zmiany" : "Dodaj danie"}
                  </Button>
                  {editingDishId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingDishId(null);
                        setDishForm({ ...emptyDishForm, categoryId: categories[0]?.id ?? "" });
                        setPhoto(null);
                      }}
                    >
                      Anuluj edycję
                    </Button>
                  ) : null}
                </div>
              </form>
            )}
          </section>

          <section className="menu-manager-card">
            <h2>Produkty ({dishes.length})</h2>
            <div className="menu-manager-dish-list">
              {dishes.map((dish) => {
                const category = categories.find((item) => item.id === dish.category_id);
                return (
                  <article className="menu-manager-dish" key={dish.id}>
                    {dish.image_url ? (
                      <img src={dish.image_url} alt="" />
                    ) : (
                      <div className="menu-manager-no-image">Brak zdjęcia</div>
                    )}
                    <div className="menu-manager-dish-info">
                      <strong>{dish.name}</strong>
                      <span>
                        {category?.name ?? "Nieznana kategoria"} ·{" "}
                        {dish.station === "bar" ? "Bar" : "Kuchnia"}
                      </span>
                      <span>
                        {dish.price_pln === null
                          ? "Cena do uzupełnienia"
                          : `${Number(dish.price_pln).toFixed(2)} zł`}
                      </span>
                      {!dish.is_available ? <span>Ukryte na stronie</span> : null}
                    </div>
                    <div className="menu-manager-actions">
                      <Button variant="outline" disabled={busy} onClick={() => editDish(dish)}>
                        Edytuj
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void toggleDishAvailability(dish)}
                      >
                        {dish.is_available ? "Ukryj" : "Pokaż"}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void deleteDish(dish)}
                      >
                        Usuń
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </ManagerFrame>
  );
}

function ManagerFrame({ children }: { children: ReactNode }) {
  return <main className="menu-manager-shell">{children}</main>;
}
