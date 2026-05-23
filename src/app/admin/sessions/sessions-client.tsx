"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
} from "@/components/ui";
import {
  createSession,
  generateWeekly,
  type ActionResult,
} from "./actions";

const initial: ActionResult = { ok: false };

export function CreateSessionForm() {
  const [state, action, pending] = useActionState(createSession, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-gray-900">Add a single session</h2>
      </CardHeader>
      <CardBody>
        <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="date">Date &amp; time</Label>
            <Input id="date" name="date" type="datetime-local" required className="w-full" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" placeholder="Park / Gym" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" placeholder="Optional" />
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add session"}
            </Button>
            {state.error && (
              <span className="ml-3 text-sm text-red-600">{state.error}</span>
            )}
            {state.ok && (
              <span className="ml-3 text-sm text-green-600">Session added.</span>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function GenerateWeeklyForm() {
  const [state, action, pending] = useActionState(generateWeekly, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-gray-900">Generate weekly sessions</h2>
        <p className="text-sm text-gray-500">
          Creates one session per week starting from the chosen date &amp; time.
        </p>
      </CardHeader>
      <CardBody>
        <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="start">First session</Label>
            <Input id="start" name="start" type="datetime-local" required className="w-full" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="count"># of weeks</Label>
            <Input
              id="count"
              name="count"
              type="number"
              min={1}
              max={52}
              defaultValue={8}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gen-location">Location</Label>
            <Input id="gen-location" name="location" placeholder="Park / Gym" />
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? "Generating…" : "Generate"}
            </Button>
            {state.error && (
              <span className="ml-3 text-sm text-red-600">{state.error}</span>
            )}
            {state.ok && (
              <span className="ml-3 text-sm text-green-600">Sessions created.</span>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
