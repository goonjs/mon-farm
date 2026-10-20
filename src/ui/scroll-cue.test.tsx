import { fireEvent, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { wrap } from '../test/render';
import { ScrollCue } from './scroll-cue';

const ui = () => (
  <ScrollCue testID="sc" footer={<Text>ต่อไป</Text>}>
    <View />
  </ScrollCue>
);
const layout = (h: number) => fireEvent(screen.getByTestId('sc'), 'layout', { nativeEvent: { layout: { height: h, width: 300, x: 0, y: 0 } } });
const content = (h: number) => fireEvent(screen.getByTestId('sc'), 'contentSizeChange', 300, h);

describe('ScrollCue (E05-S09 AC6)', () => {
  it('more below: cue on; at the end: cue off', () => {
    wrap(ui());
    layout(400);
    content(1200);
    expect(screen.getByTestId('sc-cue')).toBeTruthy();
    fireEvent.scroll(screen.getByTestId('sc'), { nativeEvent: { contentOffset: { y: 790 }, contentSize: { height: 1200, width: 300 }, layoutMeasurement: { height: 400, width: 300 } } });
    expect(screen.queryByTestId('sc-cue')).toBeNull();
  });
  it('short page: no cue, the action stays', () => {
    wrap(ui());
    layout(800);
    content(500);
    expect(screen.queryByTestId('sc-cue')).toBeNull();
    expect(screen.getByText('ต่อไป')).toBeTruthy();
  });
});
