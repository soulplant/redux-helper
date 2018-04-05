import * as t from "./types";

export interface AttemptLogin {
  username: string;
  password: string;
}

export interface RejectLogin {
  reason: string;
  foo: t.Foo;
}

export interface LoginSuccessful {
  token: string;
}

export interface GoToThing {
  subThing?: string;
}
