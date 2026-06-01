from django import forms
from django.db.models import Max

from .models import Category, Product


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

        if image and image.size > 3 * 1024 * 1024:
            raise forms.ValidationError("Category image should be under 3MB.")

        return image

    def save(self, commit=True):
        category = super().save(commit=False)

        # New category ni automatic ga last order lo pettadam
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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields["category"].queryset = Category.objects.filter(
            is_active=True
        ).order_by("sort_order", "name")

    def clean_main_image(self):
        image = self.cleaned_data.get("main_image")

        if image and image.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Main image should be under 5MB.")

        return image

    def clean_arrival_card_image(self):
        image = self.cleaned_data.get("arrival_card_image")

        if image and image.size > 5 * 1024 * 1024:
            raise forms.ValidationError("New arrival card image should be under 5MB.")

        return image

    def clean_top_showcase_image(self):
        image = self.cleaned_data.get("top_showcase_image")

        if image and image.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Top carousel image should be under 5MB.")

        return image

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
            self.add_error("offer_price", "Offer price cannot be greater than actual price.")

        return cleaned_data