# Pallavi Papa Sarees – Project File Reuse & Cleanup Notes

## Current Status

Mana project structure mostly okay undhi. Common ga use avvadanki separate files pettadam correct. Owner add product form lo recent ga chesina image tools separation, responsive CSS, color picker cleanup anni okay.

**Important note:** Owner edit product route/path already undhi, kani edit form full code inka rayaledhu. Adhi next update lo separate ga complete cheddam.

---

## 1. Reused / Shared Files

Ee files multiple pages/features lo use avuthunnayi. Ivi good reusable files.

### Public common layout

```txt
store/templates/base.html
store/templates/store/partials/header.html
store/templates/store/partials/page_loader_head.html
store/templates/store/partials/page_loader.html
store/templates/store/user_homepage/partials/site_footer.html
```

Use:
- Home page
- Collections page
- Product detail page
- Cart page
- About/contact related pages

Meaning:
- `base.html` common shell
- `header.html` common top header
- `page_loader_*` common page loader
- `site_footer.html` common footer

These files touch cheyyali ante careful testing kavali.

---

## 2. Product Card Reuse

```txt
store/templates/store/collections/partials/product_card.html
store/static/store/css/collections/product_card.css
```

Use:
- Collections grid
- New arrivals
- Product detail similar products
- Product detail explore more products

Meaning:
Same product card UI repeat kakunda one partial lo maintain chestunnam. Good reusable structure.

---

## 3. Backend Shared Files

```txt
store/models.py
store/forms.py
store/services/product_image_service.py
store/services/cloudinary_cleanup_service.py
store/cloudinary_cleanup_signals.py
store/apps.py
```

Meaning:
- `models.py` product/category/variant/highlight base structure
- `forms.py` owner add/edit product forms and validation
- `product_image_service.py` image resize/convert/compress logic
- Cloudinary cleanup files images delete/protect logic

These files sensitive. Testing lekunda change cheyyakudadhu.

---

## 4. Owner Add Product Files

Current important owner add product files:

```txt
store/templates/store/owner/partials/owner_add_product_form.html
store/static/store/owner/css/owner_add_product_form.css
store/static/store/owner/js/owner_add_product_form.js
```

Purpose:
- Add product form UI
- Product fields
- Main image/sub images/top showcase/arrival card upload sections
- Variants
- Highlights
- Save product + AJAX upload flow

These are feature-specific files. Separate ga undadam correct.

---

## 5. Shared Owner Image Tool Files

Recent ga separate chesina common image files:

```txt
store/static/store/owner/js/owner_product_image_tools.js
store/static/store/owner/css/owner_product_image_tools.css
```

Purpose:
- Image preview
- Remove image
- Image zoom modal
- Color picker from image
- Preview buttons responsive styling

Meaning:
Previously add product JS lo mixed ga unna image logic ni separate common tool ga move chesam. This is good separation.

Current usage:
- Owner add product page lo load avuthundhi
- Future owner edit product page lo reuse cheyyachu

---

## 6. Draft Autosave File

```txt
store/static/store/owner/js/product_draft_autosave.js
```

Purpose:
- Add product form draft save
- Browser localStorage/IndexedDB based recovery
- Upload flow interruption ayithe resume/help

Meaning:
Add product form ki useful. Edit page lo direct ga use cheyyali ante later careful adjust cheyyali.

---

## 7. Owner Edit Product Status

Path/route already planned/exists:

```txt
/owner/products/<product_id>/edit/
```

Likely related files:

```txt
store/owner_urls.py
store/owner_views.py
store/templates/store/owner/owner_product_edit.html
```

Current status:
- Backend path/view planning undhi
- `owner_product_edit.html` empty or incomplete
- Full edit UI code inka rayaledhu

Decision:
**Edit form ni next update lo complete cheddam.**  
Add product form ni blindly copy cheyyakudadhu. Edit flow lo existing images, existing variants, existing highlights, update/save behavior different ga untayi.

---

## 8. Current Cleanup Done

Recent completed cleanup:

```txt
Duplicate color picker buttons removed
Bottom add variant button added
Responsive owner add product layout added
Responsive image preview controls added
Backup .bak files removed
```

Current clean files:

```txt
store/static/store/owner/css/owner_add_product_form.css
store/static/store/owner/css/owner_product_image_tools.css
store/templates/store/owner/partials/owner_add_product_form.html
```

---

## 9. Possible Later Cleanup

Urgent kaadhu, but later chudali:

```txt
Favorites page route/template wiring
Owner edit product page completion
Missing about/contact size guide images
Duplicate favorite logic in collections page
Unused old CSS selectors
Unused old static images
Empty store/views.py or unused urls if any
```

---

## 10. Do Not Touch Without Testing

Ee files important. Change chesaka full test necessary:

```txt
store/models.py
store/forms.py
store/services/product_image_service.py
store/services/cloudinary_cleanup_service.py
store/cloudinary_cleanup_signals.py
store/owner_views.py
store/static/store/owner/js/owner_add_product_form.js
store/static/store/owner/js/owner_product_image_tools.js
store/templates/base.html
store/templates/store/collections/partials/product_card.html
```

---

## 11. Next Suggested Order

### Step 1: Current responsive owner add product changes push

Push current final changes first.

### Step 2: Owner edit product page

Next update lo owner edit product page complete cheyyali.

Important edit page requirements:
- Existing product values pre-fill avvali
- Existing images show avvali
- Image replace/remove flow clear ga undali
- Existing variants edit/delete/add avvali
- Existing highlights edit/delete/add avvali
- Save changes safely
- Add form code reuse possible, but blindly copy cheyyakudadhu

### Step 3: Favorites page fix

Later:
- `/favorites/` template path correct cheyyali
- JS/CSS file names check cheyyali
- `favorite_base.js` duplicate logic reduce cheyyali

---

## Final Simple Summary

```txt
Project structure okay.
Shared files correct ga unnayi.
Owner image tools separate cheyyadam correct.
Current responsive changes okay.
Edit product path undhi, but edit form code next update lo complete cheyyali.
Ippudu unnecessary big cleanup cheyyakudadhu.
First current changes push cheyyali.
Next feature: Owner edit product page.
```
