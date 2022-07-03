# ricotte-api

API-Deployment-status: early alpha

API for Ricotte no Mori game. The API uses
[rpg-ts](https://github.com/sgohlke/rpg-ts) library to handle the RPG and battle
logic. Project is using Deno Deploy. Caution: This application needs a Deno
version with Typescript 4.3 or higher. (i.e. Deno v.1.11.0 or higher)

# Use API

## Run online

The application is deployed und linked with Deno Deploy. You can access the API
on [ricotte-api.deno.dev](https://ricotte-api.deno.dev/)

## RPG data

The application uses fixed data (player, units, ...) to provide a first basic
battle.

## Database

There is no persistent database in use at the moment. Data will be written to an
in-memory variable and be lost when the application shuts down or a new
deployment is released.

### Units

- 1: "JellySlime", { hp: 6, atk: 2, def: 1 }
- 1: "Slime", { hp: 5, atk: 2, def: 1 }
- 2: "Punchbag", { hp: 1, atk: 1, def: 1 }

### Players

- p1: Player (i.e. your player character), has one "JellySlime"
- p2: Opponent (i.e. your AI opponent), has one "Slime" and one "Punchbag"

## Routes

- / (root) -> Displays a Welcome message
- /createBattle -> Creates a new Battle (p1 against p2) and returns the battleId
  for the newly generated battle
- /getBattle/:battleId -> Gets the Battle object for the given battleId provided
  in URL parameter
- /attack/:battleId/:attackingUnitId/:defendingUnitId -> Performs an attack.
  Uses the following URL parameters: battleId (the battleId, see routes above),
  attackingUnitId (the unit of p1 that is attacking, only 1 as value is
  possible), defendingUnitId (the unit of p2 that is defending, only 1 or 2 as
  value is possible).

# Development

## Run locally

To run locally execute **deno run --allow-net webserver.ts**.

## Lint

To check for linting issues execute **deno lint**.

## Code formatting

Code is formated using buildin **deno fmt** with the following options:

**deno fmt --options-indent-width=3 --options-single-quote**

## Deployment via Deno Deploy

You want to adjust the code and deploy it yourself? No problem! You can follow
the next steps in order to deploy your application to Deno Deploy.

### Preparations

You can use your existing accounts or create new ones if you do not want to use
your existing accounts for:

- [Github](https://github.com/)
- [Deno Deploy](https://deno.com/deploy/) To ease deployment you can allow Denoy
  Deploy to get data from your github projects (Deno Deploy will lead you
  through this process).

### Create deployment and link repository

- Sign in to Deno Deploy
- Click on "New Project" button
- Enter your project details
  - Github repository: The github repository your Deno app is located
  - production branch: The branch in the repository you want to use. You have to
    provide the entry point for the application that is being executed when the
    deployment is finished (in this repo it is webserver.ts containig the game
    and webserver logic).
  - name: Adjust the name if necessary
- Click on "Link" to create the deployment

When ready you can use the links provided by Deno Deploy to access you
application. If a new change is pushed to the branch you selected above a new
deployment will automatically be triggered.
