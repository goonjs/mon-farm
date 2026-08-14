import { fireEvent, screen } from '@testing-library/react-native';

import { ReopenPrompt } from './ReopenPrompt';
import { wrap } from '../test/render';


const baseProps = {
  targetLabel: 'กอง 1',
  consequence: 'ทำให้กองนี้กลับมานับต่อได้',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe('ReopenPrompt', () => {
  it('requires a non-empty reason before "next" is enabled', () => {
    wrap(<ReopenPrompt {...baseProps} />);
    expect(screen.getByTestId('reopen-prompt-next').props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('reopen-prompt-reason'), 'เข้าใจผิด');
    expect(screen.getByTestId('reopen-prompt-next').props.accessibilityState?.disabled).toBe(false);
  });

  it('shows the typed reason back before the second confirm', () => {
    wrap(<ReopenPrompt {...baseProps} />);
    fireEvent.changeText(screen.getByTestId('reopen-prompt-reason'), 'นับผิด');
    fireEvent.press(screen.getByTestId('reopen-prompt-next'));

    expect(screen.getByTestId('reopen-prompt-reason-echo').props.children).toContain('นับผิด');
  });

  it('only calls onConfirm after the second, explicit confirm', () => {
    const onConfirm = jest.fn();
    wrap(<ReopenPrompt {...baseProps} onConfirm={onConfirm} />);
    fireEvent.changeText(screen.getByTestId('reopen-prompt-reason'), 'นับผิด');
    fireEvent.press(screen.getByTestId('reopen-prompt-next'));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('reopen-prompt-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('นับผิด');
  });

  it('"back" returns to the reason step without losing the typed text', () => {
    wrap(<ReopenPrompt {...baseProps} />);
    fireEvent.changeText(screen.getByTestId('reopen-prompt-reason'), 'นับผิด');
    fireEvent.press(screen.getByTestId('reopen-prompt-next'));
    fireEvent.press(screen.getByTestId('reopen-prompt-back'));

    expect(screen.getByTestId('reopen-prompt-reason').props.value).toBe('นับผิด');
  });

  it('"cancel" calls onCancel', () => {
    const onCancel = jest.fn();
    wrap(<ReopenPrompt {...baseProps} onCancel={onCancel} />);
    fireEvent.press(screen.getByTestId('reopen-prompt-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
