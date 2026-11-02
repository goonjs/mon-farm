import { screen } from '@testing-library/react-native';

import { wrap } from '../../test/render';
import { HomeCover } from './index';

jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
jest.mock('./cover-scene', () => ({
  CoverScene: () => {
    throw new Error('svg broke');
  },
}));

it('shows the old cover when the new scene throws (CS-7)', () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  wrap(<HomeCover />);
  expect(screen.getByTestId('home-cover-classic')).toBeTruthy();
  expect(screen.queryByTestId('home-cover')).toBeNull();
});
