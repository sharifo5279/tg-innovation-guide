import test from "node:test";
import assert from "node:assert/strict";
import { isBot, utcDay, addDays, place, summarizeDay, clientIp } from "./visits.mjs";

test("bots and empty agents are skipped", () => {
  assert.equal(isBot(""), true);
  assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141 Safari/537.36"), false);
});
test("days", () => {
  assert.equal(utcDay(new Date("2026-10-08T23:59:59Z")), "2026-10-08");
  assert.equal(addDays("2026-10-01", -1), "2026-09-30");
});
test("place cleaning", () => {
  assert.deepEqual(place({ country_code: "US", state1: "North Carolina", city: "Charlotte" }), { cc: "US", region: "North Carolina", city: "Charlotte" });
  assert.deepEqual(place(null), { cc: "XX", region: "", city: "" });
});
test("summary counts opens, visitors and places", () => {
  const s = summarizeDay("2026-10-08", [
    { cc: "US", region: "North Carolina", city: "Charlotte", vid: "a" },
    { cc: "US", region: "North Carolina", city: "Charlotte", vid: "a" },
    { cc: "DE", region: "Bayern", city: "Munich", vid: "b" },
  ]);
  assert.equal(s.opens, 3); assert.equal(s.visitors, 2);
  assert.deepEqual(s.places[0], ["US", "North Carolina", "Charlotte", 1, 2]);
});
test("client address from proxy headers", () => {
  assert.equal(clientIp({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }, "10.0.0.2"), "203.0.113.9");
  assert.equal(clientIp({}, "::1"), "::1");
});
