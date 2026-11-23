import { useMemo, useRef, type PropsWithChildren } from 'react';
import { PanResponder, View, type GestureResponderEvent } from 'react-native';

import {
  zoomAt,
  type Point,
  type TreeTransform,
  type Viewport,
} from './treeLayout';

export type GestureSurfaceProps = PropsWithChildren<{
  width: number;
  height: number;
  surfaceColor: string;
  transform: TreeTransform;
  onChange: (transform: TreeTransform) => void;
}>;

type TouchGeometry = { origin: Point; distance: number; count: number };

function geometry(event: GestureResponderEvent): TouchGeometry | undefined {
  const touches = event.nativeEvent.touches;
  if (!touches.length) return undefined;
  const first = touches[0];
  const second = touches[1];
  if (!second)
    return {
      origin: { x: first.pageX, y: first.pageY },
      distance: 0,
      count: 1,
    };
  return {
    origin: {
      x: (first.pageX + second.pageX) / 2,
      y: (first.pageY + second.pageY) / 2,
    },
    distance: Math.hypot(
      first.pageX - second.pageX,
      first.pageY - second.pageY,
    ),
    count: 2,
  };
}

export function TreeGestureSurface({
  width,
  height,
  surfaceColor,
  transform,
  onChange,
  children,
}: GestureSurfaceProps) {
  const latest = useRef({ transform, onChange, viewport: { width, height } });
  latest.current = { transform, onChange, viewport: { width, height } };
  const gesture = useMemo(() => {
    let baseline: TouchGeometry | undefined;
    let initial: TreeTransform;
    let viewport: Viewport;
    let current: TreeTransform;
    function begin(touch: TouchGeometry | undefined) {
      baseline = touch;
      initial = current ?? latest.current.transform;
      viewport = latest.current.viewport;
    }
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (event, state) =>
        event.nativeEvent.touches.length > 1 ||
        Math.abs(state.dx) + Math.abs(state.dy) > 8,
      onPanResponderGrant: (event) => {
        current = latest.current.transform;
        begin(geometry(event));
      },
      onPanResponderMove: (event) => {
        const touch = geometry(event);
        if (!touch) return;
        if (!baseline || baseline.count !== touch.count) {
          begin(touch);
          return;
        }
        const factor =
          baseline.distance > 0 ? touch.distance / baseline.distance : 1;
        const zoomed = zoomAt(initial, factor, {
          x: viewport.width / 2,
          y: viewport.height / 2,
        });
        current = {
          ...zoomed,
          x: zoomed.x + touch.origin.x - baseline.origin.x,
          y: zoomed.y + touch.origin.y - baseline.origin.y,
        };
        latest.current.onChange(current);
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, []);

  return (
    <View
      {...gesture.panHandlers}
      accessibilityLabel="Interactive family tree diagram"
      style={{
        width,
        height,
        backgroundColor: surfaceColor,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {children}
    </View>
  );
}
