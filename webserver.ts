import {
   extractAccessTokenFromAuthHeader,
   GamePlayer,
   InMemoryPlayerDataStore,
   JSON_CONTENT_TYPE_HEADER,
   KVPlayerDataStore,
   logAndReturnErrorResponse,
   PlayerAgainstAIGame,
   randomCounterAttackFunction,
   returnDataResponse,
   startServer,
} from './deps.ts'

const port = 3017

const useInMemoryDataStore = false

const playerDataStore = useInMemoryDataStore
   ? new InMemoryPlayerDataStore()
   : new KVPlayerDataStore()

const jellySlimeUnit = {
   name: 'JellySlime',
   defaultStatus: { hp: 6, atk: 2, def: 1 },
}

const slimeUnit = {
   name: 'Slime',
   defaultStatus: { hp: 5, atk: 2, def: 1 },
}

const punchbagUnit = {
   name: 'Punchbag',
   defaultStatus: { hp: 1, atk: 1, def: 1 },
}

const player: GamePlayer = new GamePlayer({
   playerId: 'p1',
   name: 'Player',
})
player.addUnit(jellySlimeUnit)

const opponent: GamePlayer = new GamePlayer({
   playerId: 'p2',
   name: 'Opponent',
})
opponent.addUnit(slimeUnit)
opponent.addUnit(punchbagUnit)

const tutorialBattlePlayerId = await playerDataStore.addPlayerAccount({
   playerId: 'doesnotmatter',
   name: player.name,
   userName: player.name,
   userPassword: crypto.randomUUID(),
})
if (typeof tutorialBattlePlayerId === 'string') {
   player.playerId = tutorialBattlePlayerId
   await playerDataStore.createPlayer(player)
}

const opponentId = await playerDataStore.addPlayerAccount({
   playerId: 'doesnotmatter',
   name: opponent.name,
   userName: opponent.name,
   userPassword: crypto.randomUUID(),
})
if (typeof opponentId === 'string') {
   opponent.playerId = opponentId
   await playerDataStore.createPlayer(opponent)
}

const game = new PlayerAgainstAIGame(playerDataStore)

let kv: Deno.Kv

export async function getKv() {
   if (!kv) {
      kv = await Deno.openKv()
   }
   return kv
}

/**
 * Creates a tutorial battle
 * @param responseHeaders The initial Response headers
 * @returns A tutorial battle response
 */
async function createBattleResponse(
   responseHeaders: Headers,
): Promise<Response> {
   console.log('Calling createBattle')
   if (
      tutorialBattlePlayerId && typeof tutorialBattlePlayerId === 'string' &&
      opponentId && typeof opponentId === 'string'
   ) {
      const battleId = await game.createBattle(
         tutorialBattlePlayerId,
         opponentId,
      )
      if (battleId && typeof battleId === 'string') {
         console.log('Created battle', battleId)
         return returnDataResponse({ battleId: battleId }, responseHeaders)
      } else {
         return logAndReturnErrorResponse(
            `Creating battle failed: ${battleId}`,
            responseHeaders,
            500,
         )
      }
   } else {
      return logAndReturnErrorResponse(
         `An error occurred when using created tutorialBattlePlayerId ${JSON.stringify(tutorialBattlePlayerId)} or opponentId ${JSON.stringify(opponentId)} `,
         responseHeaders,
         500,
      )
   }
}

async function createUserBattleResponse(
   pathname: string,
   responseHeaders: Headers,
   requestHeaders: Headers,
): Promise<Response> {
   const urlParams = pathname.split('/')
   // Expected param format: [ "", "createUserBattle", "p3"]
   if (!urlParams || urlParams.length < 3) {
      return logAndReturnErrorResponse(
         `Not enough parameters provided in URL path: ${pathname}`,
         responseHeaders,
         400,
      )
   }

   // Only one param is used at the moment, maybe add opponentId later
   const playerId = urlParams[2]

   console.log('Calling createUserBattleResponse', playerId)
   if (!playerId) {
      return logAndReturnErrorResponse(
         `Cannot find playerId in URL path: ${pathname}`,
         responseHeaders,
         400,
      )
   }

   if (opponentId === undefined || typeof opponentId === 'object') {
      return logAndReturnErrorResponse(
         `Cannot select opponentId: ${opponentId}`,
         responseHeaders,
         500,
      )
   }

   const accessTokenOrError = extractAccessTokenFromAuthHeader(requestHeaders)
   if (accessTokenOrError.error) {
      return logAndReturnErrorResponse(
         `Creating battle failed for player ${playerId}. Error message is ${accessTokenOrError.error}`,
         responseHeaders,
         400,
      )
   } else {
      try {
         const battleId = await game.createBattle(
            playerId,
            opponentId,
            randomCounterAttackFunction,
            false,
            accessTokenOrError.accessToken,
         )
         if (battleId && typeof battleId === 'string') {
            console.log('Created battle', battleId)
            return returnDataResponse({ battleId: battleId }, responseHeaders)
         } else {
            return logAndReturnErrorResponse(
               `Creating battle failed: ${battleId}`,
               responseHeaders,
               500,
            )
         }
      } catch (error) {
         return logAndReturnErrorResponse(
            `Creating battle failed with error: ${error.message}`,
            responseHeaders,
            500,
         )
      }
   }
}

async function createGetBattleResponse(
   pathname: string,
   responseHeaders: Headers,
   requestHeaders: Headers,
): Promise<Response> {
   const battleId = pathname.substring(pathname.lastIndexOf('/') + 1)
   console.log('Calling getBattle', battleId)
   if (!battleId) {
      return logAndReturnErrorResponse(
         `Cannot find battleId in URL path: ${pathname}`,
         responseHeaders,
         400,
      )
   }

   const accessTokenOrError = extractAccessTokenFromAuthHeader(
      requestHeaders,
   )
   const battle = await game.getBattle(battleId, accessTokenOrError.accessToken)
   if (battle && 'battleId' in battle) {
      console.log('Return battle', JSON.stringify(battle))
      return returnDataResponse(battle, responseHeaders)
   } else if (battle === undefined) {
      return logAndReturnErrorResponse(
         `Cannot find battle for battleId: ${battleId}`,
         responseHeaders,
         400,
      )
   } else {
      return logAndReturnErrorResponse(
         `While fetching battle data an error occurred: ${
            JSON.stringify(battle)
         }`,
         responseHeaders,
         400,
      )
   }
}

async function createAttackResponse(
   pathname: string,
   responseHeaders: Headers,
   requestHeaders: Headers,
): Promise<Response> {
   const urlParams = pathname.split('/')
   // Expected param format: [ "", "attack", "p1-p2_1656878824876", "1", "1" ]
   if (!urlParams || urlParams.length < 5) {
      return logAndReturnErrorResponse(
         `Not enough parameters provied in URL path: ${pathname}`,
         responseHeaders,
         400,
      )
   }

   const battleId = urlParams[2]
   const attackingUnitId = urlParams[3]
   const defendingUnitId = urlParams[4]
   if (!battleId || !attackingUnitId || !defendingUnitId) {
      return logAndReturnErrorResponse(
         `Error extracting parameters. battleId=${battleId}, attackingUnitId=${attackingUnitId} and defendingUnitId=${defendingUnitId}`,
         responseHeaders,
         400,
      )
   }
   console.log(
      'Calling attack',
      urlParams,
      battleId,
      attackingUnitId,
      defendingUnitId,
   )

   const accessTokenOrError = extractAccessTokenFromAuthHeader(requestHeaders)
   const battle = await game.attack(
      battleId,
      Number(attackingUnitId),
      Number(defendingUnitId),
      accessTokenOrError.accessToken,
   )

   if (battle && 'battleId' in battle) {
      console.log('Return battle after attack', JSON.stringify(battle))
      return returnDataResponse(battle, responseHeaders)
   } else {
      const errorMessage = 'An error occurred while attacking'
      console.error(
         errorMessage,
         battleId,
         attackingUnitId,
         defendingUnitId,
         battle,
      )
      return logAndReturnErrorResponse(errorMessage, responseHeaders, 400)
   }
}

async function createRegisterPlayerResponse(
   request: Request,
   responseHeaders: Headers,
): Promise<Response> {
   console.log('Calling createRegisterPlayerResponse')

   if (request.method !== 'POST') {
      return logAndReturnErrorResponse(
         `Only POST method is allowed, but got: ${request.method}`,
         responseHeaders,
         405,
      )
   }

   try {
      const requestBody = await request.json()

      if (
         requestBody && requestBody.playername && requestBody.username &&
         requestBody.password
      ) {
         const newPlayer: GamePlayer = new GamePlayer({
            playerId: 'doesnotmatter',
            name: requestBody.playername,
         })
         newPlayer.addUnit(jellySlimeUnit)
         const maybePlayerId = await game.registerPlayer(
            newPlayer,
            requestBody.playername,
            requestBody.username,
            requestBody.password,
         )
         if (typeof maybePlayerId === 'string') {
            console.log(
               `Successfully registered user: ${requestBody.username} with playerId ${maybePlayerId}`,
            )
            return returnDataResponse(
               { playerId: maybePlayerId },
               responseHeaders,
            )
         } else {
            return logAndReturnErrorResponse(
               `Registering player failed with error: ${maybePlayerId.errorMessage}`,
               responseHeaders,
               400,
            )
         }
      } else {
         return logAndReturnErrorResponse(
            'Request body does not have expected fields playername, username and password',
            responseHeaders,
            400,
         )
      }
   } catch (error) {
      console.log('createRegisterPlayerResponse, error is ', error)
      return logAndReturnErrorResponse(
         `Reading request body failed with error: ${error.message}`,
         responseHeaders,
         400,
      )
   }
}

async function createLoginPlayerResponse(
   request: Request,
   responseHeaders: Headers,
): Promise<Response> {
   console.log('Calling createLoginPlayerResponse')

   if (request.method !== 'POST') {
      return logAndReturnErrorResponse(
         `Only POST method is allowed, but got: ${request.method}`,
         responseHeaders,
         405,
      )
   }

   try {
      const requestBody = await request.json()
      if (requestBody && requestBody.username && requestBody.password) {
         const maybeLoggedInPlayer = await game.login(
            requestBody.username,
            requestBody.password,
         )
         if ('playerId' in maybeLoggedInPlayer) {
            console.log(
               `Successfully logged in user: ${requestBody.username}`,
            )
            return returnDataResponse(
               maybeLoggedInPlayer,
               responseHeaders,
            )
         } else {
            return logAndReturnErrorResponse(
               `Login for player ${requestBody.username} failed with error: ${maybeLoggedInPlayer.errorMessage}`,
               responseHeaders,
               400,
            )
         }
      } else {
         return logAndReturnErrorResponse(
            'Request body does not have expected fields username and password',
            responseHeaders,
            400,
         )
      }
   } catch (error) {
      console.log('createLoginPlayerResponse, error is ', error)
      return logAndReturnErrorResponse(
         `Reading request body failed with error: ${error.message}`,
         responseHeaders,
         400,
      )
   }
}

async function handleRequest(request: Request): Promise<Response> {
   const responseHeaders = new Headers(JSON_CONTENT_TYPE_HEADER)
   const origin = request.headers.get('origin')
   if (origin) {
      responseHeaders.set('Access-Control-Allow-Origin', origin)
   }

   if (
      request.method !== 'GET' && request.method !== 'POST' &&
      request.method !== 'OPTIONS'
   ) {
      return logAndReturnErrorResponse(
         `Only GET, POST and OPTIONS methods are allowed, but got: ${request.method}`,
         responseHeaders,
         405,
      )
   }

   if (request.method === 'OPTIONS') {
      responseHeaders.set('Access-Control-Allow-Headers', 'Authorization')
      return new Response(undefined, { headers: responseHeaders })
   } else {
      const { pathname } = new URL(request.url)
      if (pathname.includes('/createUserBattle')) {
         return await createUserBattleResponse(
            pathname,
            responseHeaders,
            request.headers,
         )
      } else if (pathname.includes('/createBattle')) {
         return await createBattleResponse(responseHeaders)
      } else if (pathname.includes('/getBattle')) {
         return await createGetBattleResponse(
            pathname,
            responseHeaders,
            request.headers,
         )
      } else if (pathname.includes('/attack')) {
         return await createAttackResponse(
            pathname,
            responseHeaders,
            request.headers,
         )
      } else if (pathname.includes('/register')) {
         return await createRegisterPlayerResponse(request, responseHeaders)
      } else if (pathname.includes('/login')) {
         return await createLoginPlayerResponse(request, responseHeaders)
      } else {
         console.log('pathname is', pathname)
         return returnDataResponse(
            { message: 'Welcome to Ricotte API' },
            responseHeaders,
         )
      }
   }
}

startServer(handleRequest, { port: port })
