import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

import chalk from "chalk";
import { Command } from "commander";
import fs from "node:fs/promises";
import open from "open";
import os from "os";
import path from "path";
import yoctoSpinner from "yocto-spinner";
import * as z from "zod/v4";
import dotenv from "dotenv";
import prisma from "../../../lib/db.js";

import {
  clearStoredToken,
  getStoredToken,
  isTokenExpired,
  storeToken,
} from "../../../lib/token.js";

dotenv.config();

const URL = "http://localhost:3002";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;

export const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
export const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");

// Helper function to require authentication
async function requireAuth() {
  const token = await getStoredToken();
  const expired = await isTokenExpired();

  if (!token || expired) {
    console.log(chalk.red("❌ You are not logged in or your session has expired."));
    console.log(chalk.yellow("Please run 'orbital-cli login' first."));
    process.exit(1);
  }

  return token;
}

export async function loginAction(rawOpts) {
  const optionsSchema = z.object({
    serverUrl: z.string().optional(),
    clientId: z.string().optional(),
  });

  const parsed = optionsSchema.parse(rawOpts ?? {});
  const serverUrl = parsed.serverUrl || URL;
  const clientId = parsed.clientId || CLIENT_ID;

  if (!clientId) {
    console.error(
      chalk.red(
        "GITHUB_CLIENT_ID missing. Put it in .env or pass --client-id <id>."
      )
    );
    process.exit(1);
  }

  intro(chalk.bold("🔐 Auth CLI Login"));

  const existingToken = await getStoredToken();
  const expired = await isTokenExpired();

  if (existingToken && !expired) {
    const shouldReAuth = await confirm({
      message: "You are already logged in. Do you want to login again?",
      initialValue: false,
    });

    if (isCancel(shouldReAuth) || !shouldReAuth) {
      cancel("Login cancelled");
      process.exit(0);
    }
  }

  const authClient = createAuthClient({
    baseURL: `${serverUrl.replace(/\/$/, "")}/api/auth`,
    plugins: [deviceAuthorizationClient()],
  });

  const spinner = yoctoSpinner({ text: "Requesting device authorization..." });
  spinner.start();

  try {
    const { data, error } = await authClient.device.code({
      client_id: clientId,
      scope: "openid profile email",
    });

    spinner.stop();

    if (error || !data) {
      logger.error(
        `Failed to request device auth: ${
          error?.error_description || error?.error || "Unknown error"
        }`
      );
      process.exit(1);
    }

    const {
      device_code,
      user_code,
      verification_uri,
      verification_uri_complete,
      interval = 5,
      expires_in,
    } = data;

    console.log();
    console.log(chalk.cyan("Device Authorization Required"));
    console.log(
      `Please visit ${chalk.underline.blue(
        verification_uri_complete || verification_uri
      )}`
    );
    console.log(`Enter Code: ${chalk.bold.green(user_code)}\n`);

    const shouldOpen = await confirm({
      message: "Open the browser automatically?",
      initialValue: true,
    });

    if (!isCancel(shouldOpen) && shouldOpen) {
      const urlToOpen = verification_uri_complete || verification_uri;
      await open(urlToOpen);
    }

    console.log(
      chalk.gray(
        `Waiting for authorization (expires in ${Math.floor(
          expires_in / 60
        )} minutes)...`
      )
    );

    const token = await pollForToken(
      authClient,
      device_code,
      clientId,
      interval
    );

    if (token) {
      const saved = await storeToken(token);

      if (!saved) {
        console.log(
          chalk.yellow("\nWarning: Could not save authentication token")
        );
        console.log(
          chalk.yellow("You may need to login again next time you use the CLI.")
        );
      }

      outro(chalk.green("Login successful ✅"));
      console.log(chalk.gray(`\nToken saved to: ${TOKEN_FILE}`));
      console.log(
        chalk.gray("You can use Orbital CLI commands without logging in again.")
      );
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red("Login failed"), error?.message || error);
    process.exit(1);
  }
}

async function pollForToken(authClient, deviceCode, clientId, initialInterval) {
  let pollingInterval = initialInterval;
  const spinner = yoctoSpinner({ text: "", color: "cyan" });
  let dots = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      dots = (dots + 1) % 4;
      spinner.text = chalk.gray(
        `Polling for authorization${".".repeat(dots)}${" ".repeat(3 - dots)}`
      );
      if (!spinner.isSpinning) spinner.start();

      try {
        const { data, error } = await authClient.device.token({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: clientId,
          fetchOptions: {
            headers: {
              "user-agent": "Orbital CLI",
            },
          },
        });

        if (data?.access_token) {
          spinner.stop();
          resolve(data);
          return;
        } else if (error) {
          switch (error.error) {
            case "authorization_pending":
              break;
            case "slow_down":
              pollingInterval += 5;
              break;
            case "access_denied":
              spinner.stop();
              console.error(chalk.red("Access was denied by the user."));
              reject(new Error("access_denied"));
              return;
            case "expired_token":
              spinner.stop();
              console.error(
                chalk.red("The device code has expired. Please try again.")
              );
              reject(new Error("expired_token"));
              return;
            default:
              spinner.stop();
              logger.error(`Error: ${error.error_description}`);
              reject(new Error(error.error_description));
              return;
          }
        }
      } catch (err) {
        spinner.stop();
        logger.error(`Network error: ${err?.message || err}`);
        reject(err);
        return;
      }

      setTimeout(poll, pollingInterval * 1000);
    };

    setTimeout(poll, pollingInterval * 1000);
  });
}

export async function logoutAction() {
  intro(chalk.bold("👋 Logout"));

  const token = await getStoredToken();

  if (!token) {
    console.log(chalk.yellow("You're not logged in."));
    process.exit(0);
  }

  const shouldLogout = await confirm({
    message: "Are you sure you want to logout?",
    initialValue: false,
  });

  if (isCancel(shouldLogout) || !shouldLogout) {
    cancel("Logout cancelled");
    process.exit(0);
  }

  const cleared = await clearStoredToken();

  if (cleared) {
    outro(chalk.green("✅ Successfully logged out!"));
  } else {
    console.log(chalk.yellow("⚠️ Could not clear token file."));
  }
}

export async function whoamiAction(opts) {
  intro(chalk.bold("👤 Current User"));

  // 1. Require authentication
  const token = await requireAuth();

  if (!token?.access_token) {
    console.log(chalk.red("No access token found. Please login."));
    process.exit(1);
  }

  const spinner = yoctoSpinner({ text: "Fetching user info..." });
  spinner.start();

  try {
    // 2. Better Auth stores sessions with token as the primary identifier
    // Find the session first, then get the user
    const session = await prisma.session.findFirst({
      where: {
        token: token.access_token,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
          },
        },
      },
    });

    spinner.stop();

    if (!session || !session.user) {
      console.log(chalk.red("\n❌ Session not found or expired."));
      console.log(chalk.yellow("Please login again with 'orbital-cli login'"));
      process.exit(1);
    }

    const user = session.user;

    // 3. Display user info in a nice format
    console.log();
    console.log(chalk.cyan("━".repeat(50)));
    console.log(chalk.bold.white("  Authenticated User"));
    console.log(chalk.cyan("━".repeat(50)));
    console.log();
    console.log(chalk.gray("  Name:     ") + chalk.white(user.name || "N/A"));
    console.log(chalk.gray("  Email:    ") + chalk.white(user.email));
    console.log(chalk.gray("  User ID:  ") + chalk.dim(user.id));
    console.log(
      chalk.gray("  Joined:   ") +
        chalk.dim(new Date(user.createdAt).toLocaleDateString())
    );
    console.log();
    console.log(chalk.cyan("━".repeat(50)));
    console.log();

    // Optional: Show token expiry info
    if (token.expires_at) {
      const expiresAt = new Date(token.expires_at);
      const now = new Date();
      const hoursLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60));
      const minutesLeft = Math.floor(
        ((expiresAt - now) % (1000 * 60 * 60)) / (1000 * 60)
      );

      if (hoursLeft > 0 || minutesLeft > 0) {
        console.log(
          chalk.gray(
            `  Session expires in: ${hoursLeft}h ${minutesLeft}m`
          )
        );
      }
    }

    outro(chalk.green("✅ User info retrieved successfully"));
  } catch (error) {
    spinner.stop();
    console.error(chalk.red("\n❌ Failed to fetch user info:"), error.message);
    console.log(chalk.yellow("\nTry logging in again with 'orbital-cli login'"));
    process.exit(1);
  }
}

export const login = new Command("login")
  .description("Login to Better Auth")
  .option("--server-url <url>", "The Better Auth Server URL", URL)
  .option("--client-id <id>", "The OAuth client ID", CLIENT_ID)
  .action(loginAction);

export const logout = new Command("logout")
  .description("Logout and clear stored credentials")
  .action(logoutAction);

export const whoami = new Command("whoami")
  .description("Show current authenticated user")
  .option("--server-url <url>", "The Better Auth server URL", URL)
  .action(whoamiAction);