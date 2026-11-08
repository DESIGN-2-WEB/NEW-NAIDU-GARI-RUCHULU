import { assetUrl } from '../../api/client';

/**
 * Props that put a menu item's picture on a card: the background image, and
 * `data-has-image`, which switches the card to the photo style (picture kept
 * clear, name and price on a dark band). Used by the billing menu and by the
 * menu dialogs' previews so every card reads the same.
 */
export function cardImageProps(imageUrl) {
  const image = assetUrl(imageUrl);
  return image ? { 'data-has-image': '', style: { backgroundImage: `url('${image}')` } } : {};
}
