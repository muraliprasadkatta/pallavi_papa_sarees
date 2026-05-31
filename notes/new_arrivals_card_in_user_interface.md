# New Arrivals Image Notes

## Purpose

New Arrivals section lo product image clean ga, mobile-friendly ga, professional card design lo display avvali. User upload chesina image direct ga UI lo pettakunda, card ki suitable ga resize/convert chesi use cheyyali.

## User Nunchi Image Ela Teesukuntunnam

Owner/Admin side lo product add chesetappudu image upload chestaru.

Preferred upload format:

* JPG
* PNG
* WEBP

Preferred source image size:

* 1600 × 2000 px
* Ratio: 4:5 portrait

Reason:

* Saree full length clear ga kanipistundhi
* Crop/resize chesina quality maintain avuthundhi
* Cloudinary/storage lo optimized version pettadaniki easy

## New Arrivals Card Image

New Arrivals UI kosam separate card-friendly image use cheyyadam best.

Recommended image:

* Size: 900 × 900 px
* Ratio: 1:1 square
* Format: WEBP
* Quality: 75–82%

Target file size:

* Ideal: 80 KB – 180 KB
* Maximum: 250 KB lopu unte better

Reason:

* Mobile lo fast load avuthundhi
* Card lo saree image neat ga fit avuthundhi
* Heavy image valla page slow avvakunda untundhi

## Conversion Logic

User upload chesina original image ni backend lo process chesi WEBP format lo save cheyyali.

Main product image conversion:

* Input: JPG / PNG / WEBP
* Output: WEBP
* Target size: 1600 × 2000 px
* Ratio: 4:5 portrait
* Quality: around 82%

New Arrival card image conversion:

* Input: product image or separate arrival card image
* Output: WEBP
* Target size: 900 × 900 px
* Ratio: 1:1 square
* Quality: around 82%

## Display Ratio in UI

New Arrivals card display ratio:

Mobile:

* Card ratio: around 1.92 : 1
* Layout: horizontal scroll
* Image position: right side
* Text position: left side
* Image fit: contain
* Purpose: saree image cut avvakunda mobile lo visible ga undali

Desktop / Tablet:

* Card ratio: around 1.72 : 1
* Layout: 3 cards per row
* Image position: right side
* Text position: left side
* Image fit: cover
* Purpose: wide screen lo premium banner card look ravali

## Important Notes

* Product image and New Arrival card image same ga undalsina avasaram ledu.
* New Arrival card kosam separate cropped/positioned image pedithe best result vastundhi.
* Mobile lo saree cut avvakudadhu kabatti image `contain` style lo display chestunnam.
* Desktop lo premium look kosam image konchem zoom/crop avvadam okay.
* Long product names mobile lo auto compress avuthayi, space saripokapothe ellipsis `...` show avuthundhi.
* Best result kosam product name short ga pettali.

## Final Recommended Workflow

1. User/Admin original saree image upload chestaru.
2. Backend image ni WEBP format ki convert chestundhi.
3. Main product image 1600 × 2000 px ratio lo save avuthundhi.
4. New Arrival card image 900 × 900 px ratio lo save avuthundhi.
5. UI lo mobile screen ki auto compress, desktop screen ki auto extend avuthundhi.
6. Image file size 80 KB – 180 KB madhyalo maintain cheyyadam best.
