import { createNavigationContainerRef } from '@react-navigation/native';

/** Lets code outside any screen (deep links, notification taps) navigate. */
export const navigationRef = createNavigationContainerRef();
