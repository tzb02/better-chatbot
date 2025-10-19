"use server";

import { auth } from "@/lib/auth/server";
import { BasicUser, UserZodSchema } from "app-types/user";
import { userRepository } from "lib/db/repository";
import { ActionState } from "lib/action-utils";
import { headers } from "next/headers";

export async function existsByEmailAction(email: string) {
  const exists = await userRepository.existsByEmail(email);
  return exists;
}

type SignUpActionResponse = ActionState & {
  user?: BasicUser;
};

export async function signUpAction(data: {
  email: string;
  name: string;
  password: string;
}): Promise<SignUpActionResponse> {
  console.log("[DEBUG] signUpAction called with:", { email: data.email, name: data.name });

  const { success, data: parsedData } = UserZodSchema.safeParse(data);
  if (!success) {
    console.log("[DEBUG] signUpAction validation failed");
    return {
      success: false,
      message: "Invalid data",
    };
  }

  try {
    console.log("[DEBUG] signUpAction calling auth.api.signUpEmail");
    const { user } = await auth.api.signUpEmail({
      body: {
        email: parsedData.email,
        password: parsedData.password,
        name: parsedData.name,
      },
      headers: await headers(),
    });

    console.log("[DEBUG] signUpAction user created:", user ? "success" : "no user returned");
    console.log("[DEBUG] signUpAction response:", { success: true, message: "Successfully signed up" });

    return {
      user,
      success: true,
      message: "Successfully signed up",
    };
  } catch (error) {
    console.log("[DEBUG] signUpAction error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to sign up",
    };
  }
}
