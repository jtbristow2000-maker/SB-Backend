import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { readPayload, signUpErrorCode } from "./passwordAuth";

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/sign-up", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function formRequest(fields: Record<string, string>): NextRequest {
  const body = new URLSearchParams(fields);
  return new NextRequest("http://localhost:3000/api/auth/sign-up", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
}

describe("password auth payloads", () => {
  it("parses sign-up business fields from JSON bodies", async () => {
    const payload = await readPayload(
      jsonRequest({
        email: " owner@example.com ",
        password: "passw0rd!",
        business_name: "  Bright Detail Co  ",
        owner_name: "  Shaw  ",
        phone: " (213) 373-4253 ",
        redirectTo: "/owner/today"
      })
    );

    expect(payload).toEqual({
      email: "owner@example.com",
      password: "passw0rd!",
      businessName: "Bright Detail Co",
      ownerName: "Shaw",
      phone: "(213) 373-4253",
      redirectTo: "/owner/today"
    });
  });

  it("parses sign-up business fields from form bodies and ignores blank optionals", async () => {
    const payload = await readPayload(
      formRequest({
        email: " owner@example.com ",
        password: "passw0rd!",
        business_name: "   ",
        owner_name: " Owner Name ",
        phone: "",
        confirm_password: "ignored",
        redirectTo: "https://bad.example/owner"
      })
    );

    expect(payload).toEqual({
      email: "owner@example.com",
      password: "passw0rd!",
      businessName: null,
      ownerName: "Owner Name",
      phone: null,
      redirectTo: null
    });
  });
});

describe("sign-up error mapping", () => {
  it.each([
    [{ message: "Signups not allowed for this instance" }, "signups_disabled"],
    [{ code: "user_already_exists", message: "User already registered" }, "email_taken"],
    [{ code: "weak_password", message: "Password should be at least 6 characters" }, "weak_password"],
    [{ message: "Invalid email" }, "invalid_email"],
    [{ message: "unexpected provider failure" }, "signup_failed"]
  ])("maps %o to %s", (error, code) => {
    expect(signUpErrorCode(error)).toBe(code);
  });
});
