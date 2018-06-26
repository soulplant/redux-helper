import * as t from "./types";

/**
 * Maybe?
 * @feature "atar"
 * @userGenerated
 * @foo {"another": "one"}
 * @foo {"bar": "baz", "blah": [1,2,3]}
 */
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
