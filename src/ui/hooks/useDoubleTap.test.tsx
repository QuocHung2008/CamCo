import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { useState } from "react";
import { expect, test, vi } from "vitest";

import { useDoubleTap } from "@/ui/hooks/useDoubleTap";

function TestComponent(props: { onDouble: () => void }) {
  const handlers = useDoubleTap(props.onDouble, 400);
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setCount((c) => c + 1)}
      {...handlers}
    >
      {count}
    </button>
  );
}

test("useDoubleTap calls handler on second tap within delay", () => {
  const onDouble = vi.fn();
  const { getByRole } = render(<TestComponent onDouble={onDouble} />);
  const btn = getByRole("button");
  fireEvent.touchEnd(btn);
  fireEvent.touchEnd(btn);
  expect(onDouble).toHaveBeenCalledTimes(1);
});
