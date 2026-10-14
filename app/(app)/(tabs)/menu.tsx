import { router } from 'expo-router';
import { useEffect } from 'react';

import { useSideMenu } from '../../../src/features/navigation/SideMenu';

/**
 * The three-line tab never shows a screen of its own: pressing it opens the side menu
 * (see the tab layout). This route only catches someone who arrives at /menu directly,
 * such as a refresh on the web, and sends them Home with the menu open.
 */
export default function MenuRoute() {
  const { open } = useSideMenu();
  useEffect(() => {
    router.replace('/');
    open();
  }, [open]);
  return null;
}
