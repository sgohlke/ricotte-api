import {
   extractAccessTokenFromAuthHeader,
   GamePlayer,
   JSON_CONTENT_TYPE_HEADER,
   logAndReturnErrorResponse,
   PlayerAgainstAIGame,
   randomCounterAttackFunction,
   returnDataResponse,
   startServer,
} from './deps.ts'

const port = 3017
const game = new PlayerAgainstAIGame()

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

const playerId = game.createPlayer(player)
const opponentId = game.createPlayer(opponent)

function createBattleResponse(responseHeaders: Headers): Response {
   console.log('Calling createBattle')
   const battleId = game.createBattle(playerId, opponentId)
   if (battleId) {
      console.log('Created battle', battleId)
      return returnDataResponse({ battleId: battleId }, responseHeaders)
   } else {
      return logAndReturnErrorResponse(
         responseHeaders,
         'Creating battle failed',
         500,
      )
   }
}

function createUserBattleResponse(
   pathname: string,
   responseHeaders: Headers,
   requestHeaders: Headers,
): Response {
   const urlParams = pathname.split('/')
   // Expected param format: [ "", "createUserBattle", "p3"]
   if (!urlParams || urlParams.length < 3) {
      return logAndReturnErrorResponse(
         responseHeaders,
         `Not enough parameters provied in URL path: ${pathname}`,
         400,
      )
   }

   // Only one param is used at the moment, maybe add opponentId later
   const playerId = urlParams[2]

   console.log('Calling createUserBattleResponse', playerId)
   if (!playerId) {
      return logAndReturnErrorResponse(
         responseHeaders,
         `Cannot find playerId in URL path: ${pathname}`,
         400,
      )
   }

   const accessTokenOrError = extractAccessTokenFromAuthHeader(requestHeaders)
   if (accessTokenOrError.error) {
      return logAndReturnErrorResponse(
         responseHeaders,
         `Creating battle failed for player ${playerId}. Error message is ${accessTokenOrError.error}`,
         400,
      )
   } else {
      try {
         const battleId = game.createBattle(
            playerId,
            opponentId,
            randomCounterAttackFunction,
            false,
            accessTokenOrError.accessToken,
         )
         if (battleId) {
            console.log('Created battle', battleId)
            return returnDataResponse({ battleId: battleId }, responseHeaders)
         } else {
            return logAndReturnErrorResponse(
               responseHeaders,
               'Creating battle failed',
               500,
            )
         }
      } catch (error) {
         return logAndReturnErrorResponse(
            responseHeaders,
            `Creating battle failed with error: ${error.message}`,
            500,
         )
      }
   }
}

function createGetBattleResponse(
   pathname: string,
   responseHeaders: Headers,
   requestHeaders: Headers,
): Response {
   const battleId = pathname.substring(pathname.lastIndexOf('/') + 1)
   console.log('Calling getBattle', battleId)
   if (!battleId) {
      return logAndReturnErrorResponse(
         responseHeaders,
         `Cannot find battleId in URL path: ${pathname}`,
         400,
      )
   }

   try {
      const accessTokenOrError = extractAccessTokenFromAuthHeader(
         requestHeaders,
      )
      const battle = game.getBattle(battleId, accessTokenOrError.accessToken)
      if (battle) {
         console.log('Return battle', JSON.stringify(battle))
         return returnDataResponse(battle, responseHeaders)
      } else {
         return logAndReturnErrorResponse(
            responseHeaders,
            `Cannot find battle for battleId: ${battleId}`,
            400,
         )
      }
   } catch (error) {
      return logAndReturnErrorResponse(
         responseHeaders,
         `While fetching battle data an error occurred: ${error.message}`,
         400,
      )
   }
}

function createAttackResponse(
   pathname: string,
   responseHeaders: Headers,
   requestHeaders: Headers,
): Response {
   const urlParams = pathname.split('/')
   // Expected param format: [ "", "attack", "p1-p2_1656878824876", "1", "1" ]
   if (!urlParams || urlParams.length < 5) {
      return logAndReturnErrorResponse(
         responseHeaders,
         `Not enough parameters provied in URL path: ${pathname}`,
         400,
      )
   }

   const battleId = urlParams[2]
   const attackingUnitId = urlParams[3]
   const defendingUnitId = urlParams[4]
   if (!battleId || !attackingUnitId || !defendingUnitId) {
      return logAndReturnErrorResponse(
         responseHeaders,
         `Error extracting parameters. battleId=${battleId}, attackingUnitId=${attackingUnitId} and defendingUnitId=${defendingUnitId}`,
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
   try {
      const battle = game.attack(
         battleId,
         Number(attackingUnitId),
         Number(defendingUnitId),
         accessTokenOrError.accessToken,
      )
      console.log('Return battle after attack', JSON.stringify(battle))
      return returnDataResponse(battle, responseHeaders)
   } catch (err) {
      console.error(
         'An error occured while attacking',
         battleId,
         attackingUnitId,
         defendingUnitId,
         err.message,
      )
      return logAndReturnErrorResponse(responseHeaders, err.message, 400)
   }
}

async function createRegisterPlayerResponse(
   request: Request,
   responseHeaders: Headers,
): Promise<Response> {
   console.log('Calling createRegisterPlayerResponse')

   if (request.method !== 'POST') {
      return logAndReturnErrorResponse(
         responseHeaders,
         `Only POST method is allowed, but got: ${request.method}`,
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
         return game.registerPlayer(
            newPlayer,
            requestBody.playername,
            requestBody.username,
            requestBody.password,
         )
            .then((playerId) => {
               console.log(
                  `Successfully registered user: ${requestBody.username} with playerId ${playerId}`,
               )
               return returnDataResponse(
                  { playerId: playerId },
                  responseHeaders,
               )
            })
            .catch((err) =>
               logAndReturnErrorResponse(
                  responseHeaders,
                  `Registering player failed with error: ${err.message}`,
                  400,
               )
            )
      } else {
         return logAndReturnErrorResponse(
            responseHeaders,
            'Request body does not have expected fields playername, username and password',
            400,
         )
      }
   } catch (error) {
      console.log('createRegisterPlayerResponse, error is ', error)
      return logAndReturnErrorResponse(
         responseHeaders,
         `Reading request body failed with error: ${error.message}`,
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
         responseHeaders,
         `Only POST method is allowed, but got: ${request.method}`,
         405,
      )
   }

   try {
      const requestBody = await request.json()
      if (requestBody && requestBody.username && requestBody.password) {
         return game.login(requestBody.username, requestBody.password)
            .then((loggedInPlayer) => {
               console.log(
                  `Successfully logged in user: ${requestBody.username}`,
               )
               return returnDataResponse(
                  loggedInPlayer,
                  responseHeaders,
               )
            })
            .catch((err) =>
               logAndReturnErrorResponse(
                  responseHeaders,
                  `Login for player ${requestBody.username} failed with error: ${err.message}`,
                  400,
               )
            )
      } else {
         return logAndReturnErrorResponse(
            responseHeaders,
            'Request body does not have expected fields username and password',
            400,
         )
      }
   } catch (error) {
      console.log('createLoginPlayerResponse, error is ', error)
      return logAndReturnErrorResponse(
         responseHeaders,
         `Reading request body failed with error: ${error.message}`,
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
         responseHeaders,
         `Only GET, POST and OPTIONS methods are allowed, but got: ${request.method}`,
         405,
      )
   }

   if (request.method === 'OPTIONS') {
      responseHeaders.set('Access-Control-Allow-Headers', 'Authorization')
      return new Response(undefined, { headers: responseHeaders })
   } else {
      const { pathname } = new URL(request.url)
      if (pathname.includes('/createUserBattle')) {
         return createUserBattleResponse(
            pathname,
            responseHeaders,
            request.headers,
         )
      } else if (pathname.includes('/createBattle')) {
         return createBattleResponse(responseHeaders)
      } else if (pathname.includes('/getBattle')) {
         return createGetBattleResponse(
            pathname,
            responseHeaders,
            request.headers,
         )
      } else if (pathname.includes('/attack')) {
         return createAttackResponse(
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
