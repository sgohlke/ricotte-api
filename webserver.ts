import { GamePlayer, PlayerAgainstAIGame, serve } from './deps.ts';

const port = 3017;
const game = new PlayerAgainstAIGame();

const jellySlimeUnit = {
   joinNumber: 1,
   name: 'JellySlime',
   defaultStatus: { hp: 6, atk: 2, def: 1 },
};

const slimeUnit = {
   joinNumber: 1,
   name: 'Slime',
   defaultStatus: { hp: 5, atk: 2, def: 1 },
};

const punchbagUnit = {
   joinNumber: 2,
   name: 'Punchbag',
   defaultStatus: { hp: 1, atk: 1, def: 1 },
};

const player: GamePlayer = new GamePlayer({
   playerId: 'p1',
   name: 'Player',
   units: [jellySlimeUnit],
});

const opponent: GamePlayer = new GamePlayer({
   playerId: 'p2',
   name: 'Opponent',
   units: [slimeUnit, punchbagUnit],
});

const playerId = game.createPlayer(player);
const opponentId = game.createPlayer(opponent);

function logAndReturnErrorResponse(
   headers: Headers,
   errorMessage: string,
   errorStatusCode = 400,
): Response {
   console.error(errorMessage);
   return new Response(JSON.stringify({ error: errorMessage }), {
      headers: headers,
      status: errorStatusCode,
   });
}

function createDataResponse(data: unknown, headers: Headers): Response {
   return new Response(JSON.stringify(data), { headers: headers });
}

function createBattleResponse(headers: Headers): Response {
   console.log('Calling createBattle');
   const battleId = game.createBattle(playerId, opponentId);
   if (battleId) {
      console.log('Created battle', battleId);
      return createDataResponse({ battleId: battleId }, headers);
   } else {
      return logAndReturnErrorResponse(headers, 'Creating battle failed', 500);
   }
}

function createGetBattleResponse(pathname: string, headers: Headers): Response {
   const battleId = pathname.substring(pathname.lastIndexOf('/') + 1);
   console.log('Calling getBattle', battleId);
   if (!battleId) {
      return logAndReturnErrorResponse(
         headers,
         `Cannot find battleId in URL path: ${pathname}`,
         400,
      );
   }

   const battle = game.getBattle(battleId);
   if (battle) {
      console.log('Return battle', JSON.stringify(battle));
      return createDataResponse(battle, headers);
   } else {
      return logAndReturnErrorResponse(
         headers,
         `Cannot find battle for battleId: ${battleId}`,
         400,
      );
   }
}

function createAttackResponse(pathname: string, headers: Headers): Response {
   const urlParams = pathname.split('/');
   // Expected param format: [ "", "attack", "p1-p2_1656878824876", "1", "1" ]
   if (!urlParams || urlParams.length < 5) {
      return logAndReturnErrorResponse(
         headers,
         `Not enough parameters provied in URL path: ${pathname}`,
         400,
      );
   }

   const battleId = urlParams[2];
   const attackingUnitId = urlParams[3];
   const defendingUnitId = urlParams[4];
   if (!battleId || !attackingUnitId || !defendingUnitId) {
      return logAndReturnErrorResponse(
         headers,
         `Error extracting parameters. battleId=${battleId}, attackingUnitId=${attackingUnitId} and defendingUnitId=${defendingUnitId}`,
         400,
      );
   }
   console.log(
      'Calling attack',
      urlParams,
      battleId,
      attackingUnitId,
      defendingUnitId,
   );

   try {
      const battle = game.attack(
         battleId,
         Number(attackingUnitId),
         Number(defendingUnitId),
      );
      console.log('Return battle after attack', JSON.stringify(battle));
      return createDataResponse(battle, headers);
   } catch (err) {
      console.error(
         'An error occured while attacking',
         battleId,
         attackingUnitId,
         defendingUnitId,
         err.message,
      );
      return logAndReturnErrorResponse(headers, err.message, 400);
   }
}

function handleRequest(request: Request): Response {
   const headers = new Headers();
   headers.set('content-type', 'application/json; charset=UTF-8');

   const origin = request.headers.get('origin');
   if (origin) {
      headers.set('Access-Control-Allow-Origin', origin);
   }

   if (request.method !== 'GET') {
      return logAndReturnErrorResponse(
         headers,
         `Only GET method is allowed, but got: ${request.method}`,
         405,
      );
   }

   const { pathname } = new URL(request.url);
   if (pathname.includes('/createBattle')) {
      return createBattleResponse(headers);
   } else if (pathname.includes('/getBattle')) {
      return createGetBattleResponse(pathname, headers);
   } else if (pathname.includes('/attack')) {
      return createAttackResponse(pathname, headers);
   } else {
      return createDataResponse({ message: 'Welcome to Ricotte API' }, headers);
   }
}

serve(handleRequest, { port: port });
