interface AttemptLogin {
  username: string;
  password: string;
}

interface RejectLogin {
  reason: string;
}

interface LoginSuccessful {
  token: string;
}
