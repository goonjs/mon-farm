import { fireEvent, screen } from '@testing-library/react-native';

import { PileEditor } from './PileEditor';
import { LogBuilder, readyPile, setUpSale } from '../core/fixtures';
import { projectSale } from '../core/project';
import { wrap } from '../test/render';

const pileOf = (locked: boolean) => {
  const b = readyPile(setUpSale(new LogBuilder()), 'p1');
  if (locked) b.accept('p1');
  return projectSale(b.build()).piles.find((p) => p.id === 'p1')!;
};

/**
 * S26. The form that corrects a pile set up wrong — and the FR-3.4 lock, as
 * the operator meets it: a name is editable forever, the weights only until
 * the first basket.
 */
describe('PileEditor', () => {
  it('edits name, tare and standard net on an unlocked pile', () => {
    const onSave = jest.fn();
    wrap(<PileEditor pile={pileOf(false)} canEditNet onSave={onSave} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('pile-edit-name-p1'), 'กองหน้าบ้าน');
    fireEvent.changeText(screen.getByTestId('pile-edit-tare-p1'), '2.5');
    fireEvent.changeText(screen.getByTestId('pile-edit-std-p1'), '45');
    fireEvent.press(screen.getByTestId('pile-edit-save-p1'));

    expect(onSave).toHaveBeenCalledWith({ name: 'กองหน้าบ้าน', tareG: 2_500, stdNetG: 45_000 });
  });

  it('starts from the pile as it is now, in kilograms', () => {
    wrap(<PileEditor pile={pileOf(false)} canEditNet onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByTestId('pile-edit-name-p1').props.value).toBe('กอง 1');
    expect(screen.getByTestId('pile-edit-tare-p1').props.value).toBe('2');
    expect(screen.getByTestId('pile-edit-std-p1').props.value).toBe('50');
  });

  it('locks the weights once the pile has counted, leaving the name editable', () => {
    const onSave = jest.fn();
    wrap(<PileEditor pile={pileOf(true)} canEditNet={false} onSave={onSave} onCancel={jest.fn()} />);

    expect(screen.getByTestId('pile-edit-name-p1').props.editable).not.toBe(false);
    expect(screen.getByTestId('pile-edit-tare-p1').props.editable).toBe(false);
    expect(screen.getByTestId('pile-edit-std-p1').props.editable).toBe(false);
    expect(screen.getByTestId('pile-edit-locked-p1')).toBeTruthy();
  });

  it('saves a locked pile at the weights it already has, never at edited ones', () => {
    const onSave = jest.fn();
    const pile = pileOf(true);
    wrap(<PileEditor pile={pile} canEditNet={false} onSave={onSave} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('pile-edit-name-p1'), 'ชื่อใหม่');
    fireEvent.press(screen.getByTestId('pile-edit-save-p1'));

    expect(onSave).toHaveBeenCalledWith({
      name: 'ชื่อใหม่',
      tareG: pile.tareG,
      stdNetG: pile.stdNetG,
    });
  });

  it('says nothing about a lock while the pile is still unlocked', () => {
    wrap(<PileEditor pile={pileOf(false)} canEditNet onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByTestId('pile-edit-locked-p1')).toBeNull();
  });

  it('refuses to save a blank name or an unusable weight', () => {
    const onSave = jest.fn();
    wrap(<PileEditor pile={pileOf(false)} canEditNet onSave={onSave} onCancel={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('pile-edit-name-p1'), '   ');
    expect(screen.getByTestId('pile-edit-save-p1').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('pile-edit-name-p1'), 'กอง 1');
    fireEvent.changeText(screen.getByTestId('pile-edit-std-p1'), '0');
    expect(screen.getByTestId('pile-edit-save-p1').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('pile-edit-save-p1'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancel reports out without saving', () => {
    const onCancel = jest.fn();
    const onSave = jest.fn();
    wrap(<PileEditor pile={pileOf(false)} canEditNet onSave={onSave} onCancel={onCancel} />);

    fireEvent.changeText(screen.getByTestId('pile-edit-name-p1'), 'ทิ้งไป');
    fireEvent.press(screen.getByTestId('pile-edit-cancel-p1'));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
