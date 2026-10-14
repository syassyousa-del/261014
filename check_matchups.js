
const Unit = {
    TYPES: {
        INFANTRY: 'INFANTRY', TRANSPORT: 'TRANSPORT', TANK: 'TANK', MD_TANK: 'MD_TANK', HV_TANK: 'HV_TANK',
        ARTILLERY: 'ARTILLERY', ROCKET: 'ROCKET', HELI_TRANSPORT: 'HELI_TRANSPORT', FIGHTER: 'FIGHTER',
        BOMBER: 'BOMBER', AA_TANK: 'AA_TANK', AA_MISSILE: 'AA_MISSILE', BATTLESHIP: 'BATTLESHIP',
        DESTROYER: 'DESTROYER', SUBMARINE: 'SUBMARINE', HOVERCRAFT: 'HOVERCRAFT'
    }
};
const MATCHUPS = {
        [Unit.TYPES.INFANTRY]: {
            [Unit.TYPES.INFANTRY]: 2.5, [Unit.TYPES.TRANSPORT]: 1, [Unit.TYPES.TANK]: 0.5, [Unit.TYPES.MD_TANK]: 0.25, [Unit.TYPES.HV_TANK]: 0.05, [Unit.TYPES.ARTILLERY]: 1, [Unit.TYPES.ROCKET]: 1,
            [Unit.TYPES.HELI_TRANSPORT]: 0.5, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 0.25, [Unit.TYPES.AA_MISSILE]: 1,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 1
        },
        [Unit.TYPES.TRANSPORT]: {
            [Unit.TYPES.INFANTRY]: 5, [Unit.TYPES.TRANSPORT]: 3, [Unit.TYPES.TANK]: 1.5, [Unit.TYPES.MD_TANK]: 1, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 2, [Unit.TYPES.ROCKET]: 2,
            [Unit.TYPES.HELI_TRANSPORT]: 0.5, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 1, [Unit.TYPES.AA_MISSILE]: 2,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 3
        },
        [Unit.TYPES.TANK]: {
            [Unit.TYPES.INFANTRY]: 7, [Unit.TYPES.TRANSPORT]: 3.5, [Unit.TYPES.TANK]: 2.5, [Unit.TYPES.MD_TANK]: 1.5, [Unit.TYPES.HV_TANK]: 0.75, [Unit.TYPES.ARTILLERY]: 3.5, [Unit.TYPES.ROCKET]: 3.5,
            [Unit.TYPES.HELI_TRANSPORT]: 0.5, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 3, [Unit.TYPES.AA_MISSILE]: 3.75,
            [Unit.TYPES.BATTLESHIP]: 0.5, [Unit.TYPES.DESTROYER]: 0.5, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 2.5
        },
        [Unit.TYPES.MD_TANK]: {
            [Unit.TYPES.INFANTRY]: 9, [Unit.TYPES.TRANSPORT]: 9, [Unit.TYPES.TANK]: 8, [Unit.TYPES.MD_TANK]: 5, [Unit.TYPES.HV_TANK]: 3, [Unit.TYPES.ARTILLERY]: 9, [Unit.TYPES.ROCKET]: 9,
            [Unit.TYPES.HELI_TRANSPORT]: 2, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 8, [Unit.TYPES.AA_MISSILE]: 9,
            [Unit.TYPES.BATTLESHIP]: 1, [Unit.TYPES.DESTROYER]: 1, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 5
        },
        [Unit.TYPES.HV_TANK]: {
            [Unit.TYPES.INFANTRY]: 10, [Unit.TYPES.TRANSPORT]: 10, [Unit.TYPES.TANK]: 10, [Unit.TYPES.MD_TANK]: 8, [Unit.TYPES.HV_TANK]: 5, [Unit.TYPES.ARTILLERY]: 10, [Unit.TYPES.ROCKET]: 10,
            [Unit.TYPES.HELI_TRANSPORT]: 3, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 10, [Unit.TYPES.AA_MISSILE]: 9,
            [Unit.TYPES.BATTLESHIP]: 1.5, [Unit.TYPES.DESTROYER]: 1.5, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 6
        },
        [Unit.TYPES.ARTILLERY]: {
            [Unit.TYPES.INFANTRY]: 8, [Unit.TYPES.TRANSPORT]: 8, [Unit.TYPES.TANK]: 7, [Unit.TYPES.MD_TANK]: 5, [Unit.TYPES.HV_TANK]: 3, [Unit.TYPES.ARTILLERY]: 7, [Unit.TYPES.ROCKET]: 7,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 6, [Unit.TYPES.AA_MISSILE]: 7.5,
            [Unit.TYPES.BATTLESHIP]: 4, [Unit.TYPES.DESTROYER]: 4.5, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 7
        },
        [Unit.TYPES.ROCKET]: {
            [Unit.TYPES.INFANTRY]: 10, [Unit.TYPES.TRANSPORT]: 10, [Unit.TYPES.TANK]: 9, [Unit.TYPES.MD_TANK]: 7, [Unit.TYPES.HV_TANK]: 5, [Unit.TYPES.ARTILLERY]: 9, [Unit.TYPES.ROCKET]: 9,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 8, [Unit.TYPES.AA_MISSILE]: 9,
            [Unit.TYPES.BATTLESHIP]: 5.5, [Unit.TYPES.DESTROYER]: 6, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 9
        },
        [Unit.TYPES.HELI_TRANSPORT]: {
            [Unit.TYPES.INFANTRY]: 2.5, [Unit.TYPES.TRANSPORT]: 1.5, [Unit.TYPES.TANK]: 0.5, [Unit.TYPES.MD_TANK]: 0.25, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 1, [Unit.TYPES.ROCKET]: 1,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 0.25, [Unit.TYPES.AA_MISSILE]: 1,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 0.5
        },
        [Unit.TYPES.FIGHTER]: {
            [Unit.TYPES.INFANTRY]: 0, [Unit.TYPES.TRANSPORT]: 0, [Unit.TYPES.TANK]: 0, [Unit.TYPES.MD_TANK]: 0, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 0, [Unit.TYPES.ROCKET]: 0,
            [Unit.TYPES.HELI_TRANSPORT]: 10, [Unit.TYPES.FIGHTER]: 5, [Unit.TYPES.BOMBER]: 10, [Unit.TYPES.AA_TANK]: 0, [Unit.TYPES.AA_MISSILE]: 0,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 0
        },
        [Unit.TYPES.BOMBER]: {
            [Unit.TYPES.INFANTRY]: 10, [Unit.TYPES.TRANSPORT]: 10, [Unit.TYPES.TANK]: 10, [Unit.TYPES.MD_TANK]: 9, [Unit.TYPES.HV_TANK]: 7, [Unit.TYPES.ARTILLERY]: 10, [Unit.TYPES.ROCKET]: 10,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 8, [Unit.TYPES.AA_MISSILE]: 9,
            [Unit.TYPES.BATTLESHIP]: 7.5, [Unit.TYPES.DESTROYER]: 7.5, [Unit.TYPES.SUBMARINE]: 8.5, [Unit.TYPES.HOVERCRAFT]: 9
        },
        [Unit.TYPES.AA_TANK]: {
            [Unit.TYPES.INFANTRY]: 10, [Unit.TYPES.TRANSPORT]: 9, [Unit.TYPES.TANK]: 4, [Unit.TYPES.MD_TANK]: 1, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 4, [Unit.TYPES.ROCKET]: 4,
            [Unit.TYPES.HELI_TRANSPORT]: 6.5, [Unit.TYPES.FIGHTER]: 6, [Unit.TYPES.BOMBER]: 7, [Unit.TYPES.AA_TANK]: 4, [Unit.TYPES.AA_MISSILE]: 6,
            [Unit.TYPES.BATTLESHIP]: 0.5, [Unit.TYPES.DESTROYER]: 0.5, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 4
        },
        [Unit.TYPES.AA_MISSILE]: {
            [Unit.TYPES.INFANTRY]: 0, [Unit.TYPES.TRANSPORT]: 0, [Unit.TYPES.TANK]: 0, [Unit.TYPES.MD_TANK]: 0, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 0, [Unit.TYPES.ROCKET]: 0,
            [Unit.TYPES.HELI_TRANSPORT]: 10, [Unit.TYPES.FIGHTER]: 9, [Unit.TYPES.BOMBER]: 10, [Unit.TYPES.AA_TANK]: 0, [Unit.TYPES.AA_MISSILE]: 0,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 0
        },
        [Unit.TYPES.BATTLESHIP]: {
            [Unit.TYPES.INFANTRY]: 9, [Unit.TYPES.TRANSPORT]: 9.5, [Unit.TYPES.TANK]: 8, [Unit.TYPES.MD_TANK]: 6.5, [Unit.TYPES.HV_TANK]: 5, [Unit.TYPES.ARTILLERY]: 8.5, [Unit.TYPES.ROCKET]: 8.5,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 8, [Unit.TYPES.AA_MISSILE]: 8,
            [Unit.TYPES.BATTLESHIP]: 5, [Unit.TYPES.DESTROYER]: 6, [Unit.TYPES.SUBMARINE]: 0.5, [Unit.TYPES.HOVERCRAFT]: 8.5
        },
        [Unit.TYPES.DESTROYER]: {
            [Unit.TYPES.INFANTRY]: 0, [Unit.TYPES.TRANSPORT]: 2, [Unit.TYPES.TANK]: 1.5, [Unit.TYPES.MD_TANK]: 1, [Unit.TYPES.HV_TANK]: 0.5, [Unit.TYPES.ARTILLERY]: 2, [Unit.TYPES.ROCKET]: 2,
            [Unit.TYPES.HELI_TRANSPORT]: 8.5, [Unit.TYPES.FIGHTER]: 3, [Unit.TYPES.BOMBER]: 5, [Unit.TYPES.AA_TANK]: 2, [Unit.TYPES.AA_MISSILE]: 2,
            [Unit.TYPES.BATTLESHIP]: 2, [Unit.TYPES.DESTROYER]: 4, [Unit.TYPES.SUBMARINE]: 8, [Unit.TYPES.HOVERCRAFT]: 5
        },
        [Unit.TYPES.SUBMARINE]: {
            [Unit.TYPES.INFANTRY]: 0, [Unit.TYPES.TRANSPORT]: 0, [Unit.TYPES.TANK]: 0, [Unit.TYPES.MD_TANK]: 0, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 0, [Unit.TYPES.ROCKET]: 0,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 0, [Unit.TYPES.AA_MISSILE]: 0,
            [Unit.TYPES.BATTLESHIP]: 7, [Unit.TYPES.DESTROYER]: 5, [Unit.TYPES.SUBMARINE]: 5, [Unit.TYPES.HOVERCRAFT]: 8
        },
        [Unit.TYPES.HOVERCRAFT]: {
            [Unit.TYPES.INFANTRY]: 0, [Unit.TYPES.TRANSPORT]: 0, [Unit.TYPES.TANK]: 0, [Unit.TYPES.MD_TANK]: 0, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 0, [Unit.TYPES.ROCKET]: 0,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 0, [Unit.TYPES.AA_MISSILE]: 0,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 0
        }
    };

const types = Object.values(Unit.TYPES);
let missing = [];
for (const t1 of types) {
  if (!MATCHUPS[t1]) {
    missing.push(t1 + ' missing as attacker');
    continue;
  }
  for (const t2 of types) {
    if (MATCHUPS[t1][t2] === undefined) {
      missing.push(t1 + ' -> ' + t2 + ' missing');
    }
  }
}
console.log('Missing pairs:', missing);
