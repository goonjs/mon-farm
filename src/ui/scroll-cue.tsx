/**
 * A scrolling body with a pinned action bar that says when there is more to
 * scroll (E05-S09, owner option C): while content is below the fold the bar
 * casts a shadow upward and its buttons are faded (still pressable); at the
 * end the shadow and the fade are gone.
 */

import { useState, type ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { PinnedActions } from './button';

/** Pixels from the end that still count as "at the end". */
const END_SLACK = 24;

export function ScrollCue({ children, footer, testID, contentContainerStyle }: { children: ReactNode; footer?: ReactNode; testID?: string; contentContainerStyle?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const [box, setBox] = useState(0);
  const [content, setContent] = useState(0);
  const [y, setY] = useState(0);
  const more = box > 0 && content > box + y + END_SLACK;
  return (
    <>
      <ScrollView
        testID={testID}
        scrollEventThrottle={32}
        onLayout={(e) => setBox(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContent(h)}
        onScroll={(e) => setY(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={contentContainerStyle}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View testID={more && testID ? `${testID}-cue` : undefined} style={more ? { boxShadow: `0px -8px 12px -6px ${t.shadow.floating.color}`, zIndex: 1 } : undefined}>
          <View style={{ opacity: more ? 0.55 : 1 }}>
            <PinnedActions>{footer}</PinnedActions>
          </View>
        </View>
      ) : null}
    </>
  );
}
