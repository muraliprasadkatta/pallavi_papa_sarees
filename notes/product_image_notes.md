Pallavi Papa Sarees Collections – Product Image Notes

1. Customer upload
- Customer/admin can upload common image formats like JPG, JPEG, PNG, or WebP.
- Even if the uploaded image has a different size or ratio, our backend processes it.

2. Backend conversion
- Final stored image size: 1600 × 2000 px
- Final ratio: 4 : 5 portrait
- Width : Height = 1 : 1.25
- Final format: WebP
- WebP quality: 82

3. What our image service does
- Opens the uploaded image.
- Fixes image rotation using EXIF transpose.
- Converts the image to RGB.
- If the image has transparency, it adds a white background.
- Center-crops the image to 4:5 ratio.
- Resizes it to 1600 × 2000 px.
- Saves it as optimized WebP.

4. Display on website cards
- Product cards now use the same ratio: 4 : 5
- CSS used:
  .product-media {
    aspect-ratio: 4 / 5;
  }

5. Why this is better
- Stored image ratio and display ratio are the same.
- Image crop is minimized.
- Cards look consistent on mobile and desktop.
- Website loads optimized WebP images.
- Future product uploads stay uniform.

6. Recommended upload image
- Best source size: 1600 × 2000 px
- Minimum good source size: 800 × 1000 px
- Best ratio: 4 : 5 portrait
- Preferred formats: JPG, PNG, WebP
- Avoid very wide images, because they will be cropped from left/right.
- Avoid very tall images, because they will be cropped from top/bottom.
