from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from store.models import Category, Product, ProductVariant
from store.services.cloudinary_cleanup_service import delete_cloudinary_file_if_unused


IMAGE_FIELDS_BY_MODEL = {
    Category: ("image",),
    Product: (
        "main_image",
        "arrival_card_image",
        "top_showcase_image",
        "sub_image_1",
        "sub_image_2",
        "sub_image_3",
    ),
    ProductVariant: ("variant_image",),
}


def _get_changed_old_files(sender, instance):
    if not instance.pk:
        return []

    fields = IMAGE_FIELDS_BY_MODEL.get(sender, ())

    try:
        old_instance = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return []

    old_files = []

    for field_name in fields:
        old_file = getattr(old_instance, field_name, None)
        new_file = getattr(instance, field_name, None)

        old_name = getattr(old_file, "name", "") or ""
        new_name = getattr(new_file, "name", "") or ""

        if old_name and old_name != new_name:
            old_files.append(old_file)

    return old_files


@receiver(pre_save, sender=Category)
@receiver(pre_save, sender=Product)
@receiver(pre_save, sender=ProductVariant)
def remember_replaced_cloudinary_files(sender, instance, **kwargs):
    instance._old_cloudinary_files_to_delete = _get_changed_old_files(sender, instance)


@receiver(post_save, sender=Category)
@receiver(post_save, sender=Product)
@receiver(post_save, sender=ProductVariant)
def delete_replaced_cloudinary_files(sender, instance, **kwargs):
    old_files = getattr(instance, "_old_cloudinary_files_to_delete", [])

    for old_file in old_files:
        delete_cloudinary_file_if_unused(old_file)


@receiver(post_delete, sender=Category)
@receiver(post_delete, sender=Product)
@receiver(post_delete, sender=ProductVariant)
def delete_cloudinary_files_on_model_delete(sender, instance, **kwargs):
    fields = IMAGE_FIELDS_BY_MODEL.get(sender, ())

    for field_name in fields:
        file_value = getattr(instance, field_name, None)

        if file_value and getattr(file_value, "name", ""):
            delete_cloudinary_file_if_unused(file_value)