import {
   Application,
   GamePlayer,
   PlayerAgainstAIGame,
   Router,
} from './deps.ts';

const port = 3017;
const game = new PlayerAgainstAIGame();
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
   units: [slimeUnit],
});

const opponent: GamePlayer = new GamePlayer({
   playerId: 'p2',
   name: 'Opponent',
   units: [slimeUnit, punchbagUnit],
});

const playerId = game.createPlayer(player);
const opponentId = game.createPlayer(opponent);

const router = new Router();
router
   .get('/', (context) => {
      console.log('Calling root route');
      context.response.body = { message: 'Welcome to Ricotte API' };
   })
   .get('/createBattle', (context) => {
      console.log('Calling createBattle');
      const battleId = game.createBattle(playerId, opponentId);
      console.log('Created battle', battleId);
      const origin = context.request.headers.get('origin')
      if (origin) {
         context.response.headers.set("Access-Control-Allow-Origin", origin);
      }
      context.response.body = { battleId: battleId };
   })
   .get('/getBattle/:battleId', (context) => {
      const battleId = context?.params?.battleId;
      console.log('Calling getBattle', battleId);
      const battle = game.getBattle(battleId);
      console.log('Return battle', battle);
      context.response.body = battle;
   })
   .get('/attack/:battleId/:attackingUnitId/:defendingUnitId', (context) => {
      const battleId = context?.params?.battleId;
      const attackingUnitId = context?.params?.attackingUnitId;
      const defendingUnitId = context?.params?.defendingUnitId;
      console.log('Calling attack', battleId, attackingUnitId, defendingUnitId);
      try {
         const battle = game.attack(
            battleId,
            Number(attackingUnitId),
            Number(defendingUnitId),
         );
         console.log('Return battle', battle);
         context.response.body = battle;
      } catch (err) {
         console.error(
            'An error occured while attacking',
            battleId,
            attackingUnitId,
            defendingUnitId,
            err,
         );
         context.response.body = { error: err };
      }
   });

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

console.log(`Starting Ricotte API on port ${port}.`);
await app.listen({ port: port });
