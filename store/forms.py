from django import forms
from .models import Product


class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = [
            "category",
            "main_image",
            "sub_image_1",
            "sub_image_2",
            "sub_image_3",
            "name",
            "material",
            "actual_price",
            "offer_price",
            "description",
            "is_available",
            "is_new_arrival",
        ]

    def clean_main_image(self):
        image = self.cleaned_data.get("main_image")

        if image and image.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Main image should be under 5MB.")

        return image

    def clean(self):
        cleaned_data = super().clean()
        actual_price = cleaned_data.get("actual_price")
        offer_price = cleaned_data.get("offer_price")

        if actual_price and offer_price and offer_price > actual_price:
            self.add_error("offer_price", "Offer price cannot be greater than actual price.")

        return cleaned_data