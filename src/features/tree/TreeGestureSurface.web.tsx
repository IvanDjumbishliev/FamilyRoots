import { useEffect, useRef, type PointerEvent } from 'react';

import { zoomAt, type Point } from './treeLayout';
import type { GestureSurfaceProps } from './TreeGestureSurface';

type Touch = { x: number; y: number; distance: number };
function touchGeometry(points: Map<number, Point>): Touch | undefined {
  const [first, second] = points.values();
  if (!first) return undefined;
  return second
    ? {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
        distance: Math.hypot(first.x - second.x, first.y - second.y),
      }
    : { ...first, distance: 0 };
}

export function TreeGestureSurface({
  width,
  height,
  surfaceColor,
  transform,
  onChange,
  children,
}: GestureSurfaceProps) {
  const element = useRef<HTMLDivElement>(null);
  const ongoing = useRef({
    points: new Map<number, Point>(),
    origin: undefined as Touch | undefined,
    initial: transform,
    current: transform,
    dragging: false,
    lastDrag: 0,
  });
  const latest = useRef({ transform, onChange });
  latest.current = { transform, onChange };

  useEffect(() => {
    const canvas = element.current;
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      const unit =
        event.deltaMode === 1 ? 15 : event.deltaMode === 2 ? box.height : 1;
      const factor = Math.exp(
        Math.max(-150, Math.min(150, -event.deltaY * unit)) * 0.004,
      );
      const next = zoomAt(latest.current.transform, factor, {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
      });
      latest.current.transform = next;
      latest.current.onChange(next);
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, []);

  function local(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function finish(event: PointerEvent<HTMLDivElement>) {
    const state = ongoing.current;
    if (!state.points.delete(event.pointerId)) return;
    if (state.dragging) state.lastDrag = Date.now();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    state.origin = touchGeometry(state.points);
    state.initial = state.current;
    if (!state.points.size) state.dragging = false;
  }

  return (
    <div
      ref={element}
      role="region"
      aria-label="Interactive family tree diagram"
      tabIndex={0}
      style={{
        width,
        height,
        backgroundColor: surfaceColor,
        overflow: 'clip',
        position: 'relative',
        touchAction: 'none',
      }}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const state = ongoing.current;
        if (!state.points.size) {
          state.current = latest.current.transform;
          state.dragging = false;
        }
        state.points.set(event.pointerId, local(event));
        state.initial = state.current;
        state.origin = touchGeometry(state.points);
      }}
      onPointerMove={(event) => {
        const state = ongoing.current;
        if (!state.points.has(event.pointerId) || !state.origin) return;
        state.points.set(event.pointerId, local(event));
        const point = touchGeometry(state.points);
        if (!point) return;
        const dx = point.x - state.origin.x;
        const dy = point.y - state.origin.y;
        if (
          !state.dragging &&
          state.points.size < 2 &&
          Math.abs(dx) + Math.abs(dy) < 6
        )
          return;
        state.dragging = true;
        if (!event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.setPointerCapture(event.pointerId);
        const zoomed = zoomAt(
          state.initial,
          state.origin.distance ? point.distance / state.origin.distance : 1,
          state.origin,
        );
        state.current = { ...zoomed, x: zoomed.x + dx, y: zoomed.y + dy };
        latest.current.transform = state.current;
        onChange(state.current);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onPointerLeave={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId))
          finish(event);
      }}
      onClickCapture={(event) => {
        if (event.detail > 0 && Date.now() - ongoing.current.lastDrag < 300) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const step = 80;
        const deltas: Record<string, Point> = {
          ArrowLeft: { x: step, y: 0 },
          ArrowRight: { x: -step, y: 0 },
          ArrowUp: { x: 0, y: step },
          ArrowDown: { x: 0, y: -step },
        };
        const delta = deltas[event.key];
        if (delta) {
          event.preventDefault();
          onChange({
            ...transform,
            x: transform.x + delta.x,
            y: transform.y + delta.y,
          });
        } else if (['+', '=', '-', '_'].includes(event.key)) {
          event.preventDefault();
          onChange(
            zoomAt(
              transform,
              event.key === '-' || event.key === '_' ? 0.8 : 1.25,
              { x: width / 2, y: height / 2 },
            ),
          );
        }
      }}
    >
      {children}
    </div>
  );
}
