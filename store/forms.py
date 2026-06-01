from django import forms
from django.db.models import Max

from .models import Category, Product


PRODUCT_MAIN_MAX_MB = 5
PRODUCT_EXTRA_IMAGE_MAX_MB = 5
PRODUCT_SUB_IMAGE_MAX_MB = 5
PRODUCT_TOTAL_UPLOAD_MAX_MB = 12


def _validate_image_size(image, max_mb, label):
    if image and image.size > max_mb * 1024 * 1024:
        raise forms.ValidationError(f"{label} should be under {max_mb}MB.")
    return image


class CategoryForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = [
            "name",
            "image",
            "is_active",
        ]

        widgets = {
            "name": forms.TextInput(attrs={
                "placeholder": "Example: Womens Dresses",
            }),
            "image": forms.ClearableFileInput(attrs={
                "accept": "image/*",
            }),
        }

    def clean_name(self):
        name = (self.cleaned_data.get("name") or "").strip()

        if not name:
            raise forms.ValidationError("Category name is required.")

        return name

    def clean_image(self):
        image = self.cleaned_data.get("image")
        return _validate_image_size(image, 3, "Category image")

    def save(self, commit=True):
        category = super().save(commit=False)

        if not category.pk:
            max_order = Category.objects.aggregate(
                max_order=Max("sort_order")
            )["max_order"] or 0

            category.sort_order = max_order + 1

        if commit:
            category.save()

        return category


class ProductForm(forms.ModelForm):
    category = forms.ModelChoiceField(
        queryset=Category.objects.none(),
        required=True,
        empty_label="Select Category",
    )

    class Meta:
        model = Product
        fields = [
            "category",

            "main_image",
            "arrival_card_image",
            "top_showcase_image",
            "sub_image_1",
            "sub_image_2",
            "sub_image_3",

            "name",
            "material",
            "color_name",
            "color_code",
            "actual_price",
            "offer_price",
            "description",

            "is_available",
            "is_new_arrival",
            "is_top_selling",
            "is_most_liked",
            "is_most_carted",
        ]

        widgets = {
            "main_image": forms.ClearableFileInput(attrs={"accept": "image/*"}),
            "arrival_card_image": forms.ClearableFileInput(attrs={"accept": "image/*"}),
            "top_showcase_image": forms.ClearableFileInput(attrs={"accept": "image/*"}),
            "sub_image_1": forms.ClearableFileInput(attrs={"accept": "image/*"}),
            "sub_image_2": forms.ClearableFileInput(attrs={"accept": "image/*"}),
            "sub_image_3": forms.ClearableFileInput(attrs={"accept": "image/*"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields["category"].queryset = Category.objects.filter(
            is_active=True
        ).order_by("sort_order", "name")

    def clean_main_image(self):
        image = self.cleaned_data.get("main_image")
        return _validate_image_size(image, PRODUCT_MAIN_MAX_MB, "Main image")

    def clean_arrival_card_image(self):
        image = self.cleaned_data.get("arrival_card_image")
        return _validate_image_size(
            image,
            PRODUCT_EXTRA_IMAGE_MAX_MB,
            "New arrival card image",
        )

    def clean_top_showcase_image(self):
        image = self.cleaned_data.get("top_showcase_image")
        return _validate_image_size(
            image,
            PRODUCT_EXTRA_IMAGE_MAX_MB,
            "Top carousel image",
        )

    def clean_sub_image_1(self):
        image = self.cleaned_data.get("sub_image_1")
        return _validate_image_size(image, PRODUCT_SUB_IMAGE_MAX_MB, "Sub image 1")

    def clean_sub_image_2(self):
        image = self.cleaned_data.get("sub_image_2")
        return _validate_image_size(image, PRODUCT_SUB_IMAGE_MAX_MB, "Sub image 2")

    def clean_sub_image_3(self):
        image = self.cleaned_data.get("sub_image_3")
        return _validate_image_size(image, PRODUCT_SUB_IMAGE_MAX_MB, "Sub image 3")

    def clean_color_code(self):
        color_code = (self.cleaned_data.get("color_code") or "").strip()

        if not color_code:
            return ""

        if not color_code.startswith("#"):
            color_code = f"#{color_code}"

        if len(color_code) not in [4, 7]:
            raise forms.ValidationError("Enter a valid color code like #2f6b45.")

        valid_chars = color_code[1:]
        if not all(char in "0123456789abcdefABCDEF" for char in valid_chars):
            raise forms.ValidationError("Color code should contain only hex characters.")

        return color_code.lower()

    def clean(self):
        cleaned_data = super().clean()

        actual_price = cleaned_data.get("actual_price")
        offer_price = cleaned_data.get("offer_price")

        if actual_price and offer_price and offer_price > actual_price:
            self.add_error(
                "offer_price",
                "Offer price cannot be greater than actual price.",
            )

        image_fields = [
            "main_image",
            "arrival_card_image",
            "top_showcase_image",
            "sub_image_1",
            "sub_image_2",
            "sub_image_3",
        ]

        total_size = 0
        for field_name in image_fields:
            image = cleaned_data.get(field_name)
            if image:
                total_size += getattr(image, "size", 0) or 0

        max_total_bytes = PRODUCT_TOTAL_UPLOAD_MAX_MB * 1024 * 1024
        if total_size > max_total_bytes:
            raise forms.ValidationError(
                f"Total image upload size should be under {PRODUCT_TOTAL_UPLOAD_MAX_MB}MB. "
                "Please upload fewer or smaller images."
            )

        return cleaned_data