// Approved replacement objects for js/heroes-data.js. Final-state mechanics verified through Season 6.1.
export const PATCHED_HEROES_DATA = {
  "0001": {
    "id": "0001",
    "difficulty": "20",
    "description": "An all-rounder who dives headfirst into enemy lines and fights with relentless determination.\nUse Kaioken at just the right time, then finish the fight with Spirit Bomb or Kamehameha!",
    "statsPath": "M 100.0 30.0 L 146.9 62.6 L 158.5 113.4 L 117.4 136.0 L 84.4 132.4 L 47.4 112.0 L 45.3 56.4 L 100.0 30.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Violent Rage",
        "desc": "If an ally hero near you is KO'd by an enemy, that enemy becomes a Target of Anger.\nThis makes them findable anywhere for a set period and increases your DMG against them."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Kamehameha",
        "desc": "Fire a Kamehameha.\nWhen Kaioken is active, the duration and size of this attack increases, and Movement Speed Down will be applied to enemies it hits."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Meteor Hammer",
        "desc": "Leap into the midst of your enemies and smash your fist down.\nWhen Kaioken is active, it generates a shockwave that applies Movement Speed Down to enemies hit."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Kaioken",
        "desc": "Grants you Strike Attack Up, All Defense Up, and Movement Speed Up.\nActivating this on top of other Skills will power them up."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Spirit Bomb",
        "desc": "Unleash an orb of amassed spirit energy. DMG increases based on the number of remaining ally heroes.\nWhen Kaioken is active, an explosion will be triggered dealing even more DMG."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Saiyan",
        "desc": "Can transform at Level 7. The effect of Violent Rage will improve."
      }
    ]
  },
  "0002": {
    "id": "0002",
    "difficulty": "0",
    "description": "An indomitable hero who fights using powerful abilities while recovering armor.",
    "statsPath": "M 100.0 60.0 L 123.5 81.3 L 168.2 115.6 L 117.4 136.0 L 91.3 118.0 L 22.0 117.8 L 45.3 56.4 L 100.0 60.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Prince's Pride",
        "desc": "Gain a Reduce Cooldown effect when your HP is below a certain percentage."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Energy Blast Volley",
        "desc": "Fire multiple energy blasts. Recover armor when you hit enemies. Enemies hit by the attack receive Movement Speed Down. When this Skill is at Level 3 (Super), it causes an explosion that consumes nearby enemies. You can move and change direction while firing."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Photon Bomber",
        "desc": "Fire an energy blast and cause an explosion. Enemies are forcibly moved towards the center of the explosion. Energy blasts from enemy Rush Attacks will be destroyed if hit by the explosion."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Explosive Wave",
        "desc": "Generate an explosion centered around yourself. Forcibly moves enemies away and recovers armor upon hit."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Big Bang Attack",
        "desc": "Fire an energy blast that causes a massive explosion. Recover armor when it hits an enemy. Repeated hits on the same enemy progressively increase the DMG dealt to that enemy."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Saiyan",
        "desc": "Can transform at Level 7. Raises base HP, armor, and all attack power."
      }
    ]
  },
  "0003": {
    "id": "0003",
    "difficulty": "40",
    "description": "A crafty hero who blinds foes with Solar Flare, and catches them off guard with hidden Energy Mines.",
    "statsPath": "M 100.0 50.0 L 115.6 87.5 L 168.2 115.6 L 143.4 190.1 L 82.6 136.0 L 66.9 107.6 L 45.3 56.4 L 100.0 50.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Technician",
        "desc": "Applying Marked to enemies will immediately lower the cooldown on your Skills and Super Attack."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nThe third consecutive attack will be powered up and deal increased DMG.\nIf the powered-up attack hits an enemy with Marked, it will extend the Marked duration."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Energy Mine",
        "desc": "Place an energy blast that becomes hidden after a set time.\nWhen an enemy hero comes in range, it explodes after a set time.\nIt also explodes when hit by an energy attack.\nMarked is applied to enemies hit by the main explosion. Enemies hit by a chained or secondary explosion also receive Movement Speed Down."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Solar Flare",
        "desc": "Unleash a powerful light. Applies Flash, Marked, Shrink Field of View, and All Attack Down to enemies facing Krillin."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Scattering Energy Wave",
        "desc": "Fire a controllable energy blast. When it hits an enemy hero or object, or when the Skill is used again, it will disperse and drop, generating Smoke. The dispersed blasts will pursue any Marked enemies caught in the area."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Destructo-Disc",
        "desc": "Unleash multiple energy discs. They will penetrate enemy heroes and walls.\nIf an enemy hero is Marked, the attack will pursue them. And if an enemy hero with over 3 debuffs comes into contact with the center of a disc, they will receive extra DMG."
      }
    ]
  },
  "0006": {
    "id": "0006",
    "difficulty": "20",
    "description": "A physical hero who charges in and overwhelms enemies with absolute fury.",
    "statsPath": "M 100.0 20.0 L 154.7 56.4 L 139.0 108.9 L 108.7 118.0 L 61.0 181.1 L 80.5 104.5 L 60.9 68.8 L 100.0 20.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Assault Rush",
        "desc": "An Assault Target is applied for a set time after landing four consecutive attacks other than Rush Attacks on the same enemy hero, increasing your DMG against them."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nBecomes a powered-up attack immediately after activating, increasing range and damage."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Destructo-Disc",
        "desc": "Unleash an energy disc that deals fixed DMG according to Skill Level.\nIt pursues an enemy hero if you successfully attacked them immediately before activating this Skill."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Lightning Step",
        "desc": "Unleash a charging kick.\nThe more stacks of Assault Rush applied to the target, the greater the DMG."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Accel Dash",
        "desc": "Perform a lunging attack. If the attack hits an enemy, it can be reactivated immediately.\nKOing an enemy within a set period after activating Accel Dash extends the reactivation window and increases the number of available reactivations."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Heart Breaker",
        "desc": "Unleash a powerful punch that creates a shockwave and explosion on hit.\nThis attack deals additional DMG to enemies with an Assault Target.\nApplies Stagger to enemy heroes hit.\nDefeating enemy heroes or assisting ally heroes reduces the cooldown."
      }
    ]
  },
  "0007": {
    "id": "0007",
    "difficulty": "0",
    "description": "A healer who restores team HP with Healing Ray.",
    "statsPath": "M 100.0 80.0 L 139.1 68.8 L 139.0 108.9 L 143.4 190.1 L 74.0 154.1 L 51.3 111.1 L 60.9 68.8 L 100.0 80.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Majin Menace",
        "desc": "Gain stock when healing yourself or allied heroes, or when you apply debuffs to enemy heroes. Rush Attacks consume stocks for a DMG boost."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Strangle Gum",
        "desc": "Throw an ensnaring gum.\nApplies All Attack Down and Movement Speed Down to enemies, and also causes their hitbox to expand."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Healing Ray",
        "desc": "Heal the HP of yourself and allies.\nThe healing effect increases the closer an ally is, and stops if they move too far away.\nHigher levels of this Skill allow you to heal more ally heroes at once.\nCan move while in use."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Ready, Go!",
        "desc": "Attack while moving. Applies Strike Defense Up to yourself and forcibly moves enemies hit.\nYou can change direction while moving, or cancel by using the Skill again."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Candy Ray",
        "desc": "Fire a beam of light that turns enemy heroes into Candy, and creates an AoE that heals the HP of yourself and ally heroes.\nThe more enemy heroes you turn into Candy, the greater the healing effect."
      }
    ]
  },
  "0008": {
    "id": "0008",
    "difficulty": "20",
    "description": "A hero with immortality who fights while healing base HP using Body Regeneration.",
    "statsPath": "M 100.0 70.0 L 146.9 62.6 L 168.2 115.6 L 121.7 145.0 L 82.6 136.0 L 41.5 113.4 L 45.3 56.4 L 100.0 70.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Body Regeneration",
        "desc": "Attack enemy NPCs and bosses with Skills (excluding Super Attacks) to charge the Regeneration Gauge. The Regeneration Gauge will deplete as it heals your base HP. \nIf the gauge is at a certain amount when you are knocked out, you will revive."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Heavenly Arrow",
        "desc": "Fire energy blasts in succession. Enemy heroes hit will be afflicted with Movement Speed Down.\nYou can move and change direction while firing."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Divine Rush",
        "desc": "Lunge forward with a piercing knifehand attack. Enemy heroes hit by the attack are forcibly moved. Enemy heroes hit by the dead center of the knifehand also receive Movement Speed Down."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Fierce God Slicer",
        "desc": "Sweep the area around you with a horizontal slash. Continuous Damage will be applied to enemies hit by the attack.\nEnergy blades are unleashed outward along with the sweep.\nCan move while using this Skill."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Project Zero Mortals",
        "desc": "Drop an energy blast down on yourself.\nGain Immune to All.\nA Movement Speed Down area is created at the point where the energy blast impacts, with the effect becoming stronger toward the center.\nDMG increases according to the amount of Regeneration Gauge available when the Super Attack is activated."
      }
    ]
  },
  "0009": {
    "id": "0009",
    "difficulty": "60",
    "description": "A support hero who grows stronger with allies using Friendship Boost!",
    "statsPath": "M 100.0 70.0 L 131.3 75.1 L 148.7 111.1 L 139.0 181.1 L 61.0 181.1 L 51.3 111.1 L 68.7 75.1 L 100.0 70.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Friendship Boost",
        "desc": "Stay near an ally hero for a certain amount of time to gain All Defense Up and apply All Attack Up to the ally hero."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nApplies Physical Defense Down to enemies hit by the opening attack a certain number of times."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Masenko",
        "desc": "Unleash an energy blast. Enemies hit by this attack will be forcibly moved."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Masenkyaku",
        "desc": "Rush forward and unleash a roundhouse kick. Charging this attack will increase its range and DMG, and when fully charged, it will stagger enemies on hit. When not fully charged, it applies No Skills to enemies on hit."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Leave This to Me!",
        "desc": "Choose a single ally hero and warp to them.\nAfter warping, create a barrier centered around yourself. While inside the barrier, you and the selected ally hero gain Energy Defense Up."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Exploding Rage",
        "desc": "Unleash energy around yourself. Applies Strike Attack Up to ally heroes within the AoE for a limited time. Gain Strike Defense Up and increase the number of hits in your Rush Attack."
      },
      {
        "id": "super_attack2",
        "type": "super_attack",
        "name": "Shattering Beam",
        "desc": "Can be used while Exploding Rage is active. Lunge forward with a kick, followed by firing a large, explosive blast on the targeted point.\nEnemies hit by the initial kick will be staggered."
      }
    ]
  },
  "0010": {
    "id": "0010",
    "difficulty": "80",
    "description": "A parasite hero who manipulates both allies and enemies from the shadows. Inflict relentless pain and seize control of enemies' weakened bodies before they have a chance to strike back!",
    "statsPath": "M 100.0 80.0 L 139.1 68.8 L 158.5 113.4 L 130.4 163.1 L 87.0 127.0 L 51.3 111.1 L 37.5 50.1 L 100.0 80.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Possession (Enemies)",
        "desc": "Possess a target enemy hero when you land a Finisher. You can use some of their Skills while they are possessed, but certain actions cannot be performed.\nWhen possession begins, cooldowns for Skills (Super Attacks excluded) immediately end.\nPossession effect ends when the target respawns or when their HP is depleted."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nRange increases immediately after losing possession of target.\n\nWhile possessing an ally:\nFire multiple energy blasts that explode at nearby enemies. If an explosion hits an enemy, the HP of the possessed ally hero will be restored."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Finger Blitz Barrage",
        "desc": "Unleash an energy attack spread in a targeted direction. Enemies hit will be forcibly moved.\nCan move while using this Skill."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Energy Explosion",
        "desc": "Unleash a continuous AoE attack centered around yourself. \nGain Strike Defense Up.\nApplies Movement Speed Down to enemies hit by the attack. And each time the attack hits an enemy hero, cooldown on Possession (Allies) will decrease.\nCan move while using this Skill."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Possession (Allies) / Cover Fire",
        "desc": "Possess a target ally.\nApplies Steal Life to the possessed ally hero.\nYour HP replenishes over time, and you can use Cover Fire to attack enemies. Enemies hit by Cover Fire receive Movement Speed Down.\nWhile possessing an ally, cooldowns for your other Skills (Super Attacks excluded) are reduced.\nThe HP of the possessed ally recovers when Cover Fire hits an enemy."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Revenge Blast",
        "desc": "Unleash a shockwave centered around yourself.\nYou will receive additional HP depending on the number of enemy heroes hit by the attack.\nIf the attack hits an enemy hero, the DMG of this Skill will increase the next time it is used."
      }
    ]
  },
  "0011": {
    "id": "0011",
    "difficulty": "80",
    "description": "A leader hero who controls the battlefield by issuing orders to Zarbon and Dodoria.",
    "statsPath": "M 100.0 80.0 L 131.3 75.1 L 178.0 117.8 L 139.0 181.1 L 61.0 181.1 L 70.8 106.7 L 84.4 87.5 L 100.0 80.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Fearsome Emperor",
        "desc": "Prevents being interrupted by an attack during quick movement while also increasing speed.\nEffect will expire after being hit by an attack, but this effect can be used again after a certain amount of time."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nIf the attack lands, subordinates will launch a follow-up energy blast to deal more DMG.\nSubordinates who are deployed will prioritize attacking your target."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Show Them, Zarbon!",
        "desc": "Position Zarbon, who will attack enemies in the area with energy blasts.\nPrioritizing targets in the middle of Rush Attacks, when his energy blast hits an enemy hero it applies Strike Defense Down.\nUse the Skill again to have Zarbon leave his position."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Crush Them, Dodoria!",
        "desc": "Position Dodoria, who will attack enemies in the area with lunge attacks.\nPrioritizing targets in the middle of Rush Attacks, when his lunge attack hits an enemy hero they are forcibly moved.\nUse the Skill again to have Dodoria leave his position."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Imperial Decree",
        "desc": "Grant you and ally heroes Movement Speed Up, and create an area that raises Zarbon and Dodoria's attack speed.\nIf ally heroes, Zarbon, or Dodoria are nearby when the Skill is activated, the effects will last longer."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Supernova",
        "desc": "Drop an enormous energy ball. Charging increases the size of the energy blast and its range.\nThe impact leaves a burning area that deals Continuous Damage and applies Burning to enemies inside it."
      }
    ]
  },
  "0012": {
    "id": "0012",
    "difficulty": "60",
    "description": "A hero specializing in close-range combat who wields the power of petrification and fire-based magic.",
    "statsPath": "M 100.0 40.0 L 146.9 62.6 L 168.2 115.6 L 121.7 145.0 L 82.6 136.0 L 61.0 108.9 L 60.9 68.8 L 100.0 40.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Demon's Domain",
        "desc": "Fills the Petrification Gauge of enemy heroes within a certain proximity.\nWhen their Petrification Gauge is full, you can use a Rush Attack to Petrify them, stopping their movement and increasing your DMG against them."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nThe third consecutive attack will be powered up and fill the enemy's Petrification Gauge on hit."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Doom's Ray",
        "desc": "Blow away a targeted enemy.\nIf this attack hits an enemy hero it fills their Petrification Gauge.\nThe lower their Petrification Gauge is, the more Petrification will be applied.\nGuaranteed hits restore your base HP.\nAlso generates an aftershock ahead of you.\nActivates quicker if used after Vanishing Step."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Darkness Spear",
        "desc": "Throw a volley of spears. Applies Movement Speed Down to the enemy heroes they hit.\nGain Movement Speed Up when approaching an enemy hero hit by this Skill."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Evil Flame",
        "desc": "Spit flames. Applies No Vanishing Step to enemies hit.\nEnemy heroes hit will also be afflicted with Burning and their Petrification Gauge will be filled.\nCan move and change direction while using this Skill."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Evil Blast",
        "desc": "Unleash a powerful energy blast attack. Fills the Petrification Gauge of enemy heroes on hit.\nDMG increases near the center of the attack."
      }
    ]
  },
  "0015": {
    "id": "0015",
    "difficulty": "0",
    "description": "A hero who specializes in group tactics and dominates the field with powerful energy blasts and explosions.",
    "statsPath": "M 100.0 30.0 L 123.5 81.3 L 197.5 122.3 L 108.7 118.0 L 91.3 118.0 L 70.8 106.7 L 76.5 81.3 L 100.0 30.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Galactic Assassin",
        "desc": "If a Rush Attack is used against an enemy hero damaged by your Skills, your subordinates will perform a follow-up attack."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nThe number of blasts increases when used in succession."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Galactic Buster",
        "desc": "Fire two energy blasts that explode on impact."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Cosmic Bloom",
        "desc": "Scatter energy orbs. They will explode when hit by an energy attack from an enemy or ally hero, or after a set amount of time passes. \nCan move and change direction after activating this Skill."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Psycho Thread",
        "desc": "Call upon your subordinates and send out threads of energy.\nApplies Movement Speed Down and No Vanishing Step, and damages enemies within the AoE.\nA subordinate retreats if damaged, but the number summoned increases according to Skill Level.\nAfter dealing Continuous Damage, additional explosions occur based on the number of subordinates remaining."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Giga Grand Smasher",
        "desc": "Call upon your subordinates to fire 5 energy blasts as a team.\nAfter a set amount of time, the energy blasts will converge at the center."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Full Power",
        "desc": "Can transform at Level 7. \nFollow-up attacks from subordinates during Galactic Assassin will deal enhanced DMG."
      }
    ]
  },
  "0016": {
    "id": "0016",
    "difficulty": "40",
    "description": "A dependable, big-sister hero who protects allies by provoking the enemy.",
    "statsPath": "M 100.0 50.0 L 131.3 75.1 L 158.5 113.4 L 121.7 145.0 L 74.0 154.1 L 41.5 113.4 L 45.3 56.4 L 100.0 50.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Bring It On",
        "desc": "Enemies you have Provoked will deal less DMG to you."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nDeals more DMG to Provoked enemies."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Storm Kick",
        "desc": "Attack with a triple roundhouse kick. \nApplies Provoked to enemies you hit. \nIf the attack hits at close range, the duration of Provoked will be extended. \nCan move and change aim direction while using this Skill."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Blaze Dive",
        "desc": "Fire an explosive energy blast. Performs a follow-up attack on enemy heroes hit.\nProvoked enemy heroes take additional DMG. Gain Movement Speed Up when the additional DMG is successfully dealt to a Provoked enemy hero."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Energy Release",
        "desc": "Release a field of energy around you.\nBlocks enemy energy attacks and prevents enemies from approaching.\nApplies Movement Speed Down to enemies hit by the released energy."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Crush Cannon",
        "desc": "Release a large wave of energy, applying Provoked to any enemies it hits.\nCan move and change direction while using this Skill."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Saiyan 2",
        "desc": "Can transform at Level 7. \nRaises DMG reduction of the Passive, Bring it On."
      }
    ]
  },
  "0017": {
    "id": "0017",
    "difficulty": "40",
    "description": "A hero who skillfully keeps enemies at mid-range!\nRush in with a flurry of Power Pole attacks and maneuver alongside Panzy and Glorio!",
    "statsPath": "M 100.0 40.0 L 154.7 56.4 L 158.5 113.4 L 104.3 109.0 L 69.6 163.1 L 51.3 111.1 L 68.7 75.1 L 100.0 40.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Battle Gear",
        "desc": "Strike DMG gradually increases while engaged in battle.\nFighting a hero with a higher level than yours will accelerate the DMG increase."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "Attack while wielding the Power Pole.\nThe pole's range gradually increases during the attack.\nThis range will reset if the attack is interrupted."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Panzy: Wasabi Bomb",
        "desc": "Panzy throws a bomb at a targeted location.\nThe bomb will explode after a set amount of time has passed.\nThe farther away the set location, the longer it will be until the explosion.\nYou can move the bomb by hitting it with a Rush Attack.\nEnemies caught in the explosion will suffer continuous damage.\nThe bomb will explode upon being hit by Nyoibo Dance, and will unleash a larger explosion with increased AoE if hit by Lightning Bolt."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Glorio: Lightning Bolt",
        "desc": "Glorio calls down lightning upon the nearest enemy or Wasabi Bomb in range.\nEnemies or bombs near the bolt will be struck by chain lightning, and the DMG inflicted will increase with each connective strike."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Nyoibo Dance",
        "desc": "Sweep through the surrounding area with a Power Pole performance.\nDMG dealt increases the farther away enemies are.\nIf hit during this Skill, the first instance of DMG is halved.\nGain Energy Defense Up and Movement Speed Up if hit by an energy attack, and gain Strike Defense Up and Movement Speed Up if hit by a strike attack. Activating a Panzy: Wasabi Bomb explosion with Nyoibo Dance also grants Energy Defense Up and Movement Speed Up.\nCan move while attacking. Activating a Rush Attack cancels this Skill."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Swift Spark",
        "desc": "Transform into a Super Saiyan and dash toward a target position, unleashing a barrage of high-speed attacks.\nGain Immune to All from the start of the transformation until the end of the dash.\nFollowing the barrage, move a set distance based on directional input and deal additional DMG with an energy explosion.\nThe farther away the target, the more the AoE and movement range after the barrage increase.\nThe more DMG taken while Immune to All, the more DMG the final explosion deals."
      }
    ]
  },
  "0019": {
    "id": "0019",
    "difficulty": "20",
    "description": "A loyal hero who fights while protecting allies with barriers! Take on anything with limitless energy as you lead your allies to victory!",
    "statsPath": "M 100.0 60.0 L 107.8 93.8 L 148.7 111.1 L 143.4 190.1 L 65.3 172.1 L 41.5 113.4 L 60.9 68.8 L 100.0 60.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Infinite Energy Reactor",
        "desc": "Use energy to reactivate your skills. Skills (excluding Super Attacks) can be activated while on cooldown. Energy used will be recovered over time. The more Skills that are on cooldown, the faster your energy will replenish."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "Fire an energy blast. If it hits an enemy while they are transforming, it will interrupt their transformation."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Barrier Ball",
        "desc": "Kick a barrier in a targeted direction. Enemies hit by the attack will have their damage, defense, and movement speed buffs converted to debuffs (effect diminishes over time).\nIf reactivated with Infinite Energy Reactor, the enemy will also receive additional damage based on the number of debuffs applied. At Skill Level 3 (Super), the number of barriers will increase."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Barrier Knuckle",
        "desc": "Rush forward in a targeted direction and strike with barrier-clad fists. Enemies hit by the attack will be afflicted with Movement Speed Down (effect diminishes over time).\nIf reactivated with Infinite Energy Reactor, an additional stagger effect will be applied."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Android Barrier",
        "desc": "Form a barrier to protect yourself and ally heroes. You and any ally heroes nearby will gain extra HP.\n If reactivated with Infinite Energy Reactor, Movement Speed Up will also be applied (effect diminishes over time)."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Counter Barrier",
        "desc": "Form a barrier to protect yourself and ally heroes while blowing up the surrounding area. You and nearby ally heroes gain extra HP and Movement Speed Up when the Super Attack is activated.\nApplies No Healing EX to enemies hit by the attack. The less total HP you have, the more DMG dealt and the more extra HP received."
      }
    ]
  },
  "0020": {
    "id": "0020",
    "difficulty": "80",
    "description": "A hitman who can blindside enemies with deadly attacks! Disorient your targets with Fear of Death, then approach sight unseen to quickly finish the job!",
    "statsPath": "M 100.0 40.0 L 107.8 93.8 L 148.7 111.1 L 134.7 172.1 L 56.6 190.1 L 61.0 108.9 L 76.5 81.3 L 100.0 40.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Fear of Death",
        "desc": "Apply a debuff that shrinks the target's field of view. Fear of Death will be applied when attacking an enemy hero who has not spotted you.\nStacking Fear of Death will apply Movement Speed Down to the enemy and they will receive additional DMG, while the cooldown for Dimensional Infiltration will also be shortened."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "Range increases during Stealth or while in a bush and undiscovered by an enemy.\nBecomes a powered-up attack if used against an enemy hero while in this state, warping you to an enemy hero's position and dealing more DMG."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Deathblow",
        "desc": "Fire an energy attack that penetrates enemies and walls.\nIf this is activated during Stealth or while in a bush, the effects of Stealth or the bush will remain."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Vital Point Strike",
        "desc": "A thrust attack. Generates a shockwave with the attack from Skill Level 2.\nStaggers enemy heroes who haven't discovered you when it hits."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Dimensional Infiltration",
        "desc": "Warp to a set position and enter an alternate space-time, granting buffs.\nApplies Stealth and Movement Speed Up to self while in the alternate space-time.\nThese effects will be canceled if hit by an enemy attack or upon using a Rush Attack or Skill (Deathblow excluded)."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Assassin's Domain",
        "desc": "Unleash murderous energy, granting yourself buffs.\nApplies Fear of Death, Movement Speed Down, Obscured Vision, and Energy Defense Down to nearby enemies, and applies the same effects as Dimensional Infiltration to yourself.\nIf the effects of Dimensional Infiltration are canceled, they are reapplied so long as no actions other than movement are performed."
      }
    ]
  },
  "0022": {
    "id": "0022",
    "difficulty": "60",
    "description": "A (super)hero tag team, with Gamma 1 specializing in large-scale brawls and Gamma 2 in small-scale skirmishes!",
    "statsPath": "M 100.0 50.0 L 162.5 50.1 L 158.5 113.4 L 108.7 118.0 L 65.3 172.1 L 51.3 111.1 L 53.1 62.6 L 100.0 50.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Gamma Switch",
        "desc": "Allows Gamma 1 & Gamma 2 to swap in battle.\nEach Gamma has their own base HP and Rush Attack. Gamma 2 has increased Movement Speed.\nThe two swap when certain Skills are used or when their base HP reaches 0.\nWhen on standby with 0 base HP, either Gamma can be revived by performing Special Pose or healing at the spawn point."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "Gamma 1: A blast using a ray gun.\nGamma 2: A physical attack.\nThe third consecutive attack will be powered up, and the Gamma on standby will follow up with a ray gun attack that deals additional DMG.\nMore DMG is dealt while Special Pose is in effect"
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Gamma Strike",
        "desc": "As Gamma 2, dash forward and deliver a strike.\nThe skill can be reactivated immediately after use.\n If a third hit lands, it explodes and deals additional DMG.\n Cannot be activated when Gamma 2's base HP is 0.\n While under the effect of Special Pose, you gain additional HP upon activation and when the strike hits."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Gamma Impact",
        "desc": "As Gamma 1, deal a flying kick that causes a shockwave.\nGains extra HP upon activation and when the shockwave hits.\n Creates an explosion after the shockwave and deals more DMG at Skill Level 3 (Super).\n Cannot be activated when Gamma 1's base HP is 0.\n More DMG is dealt while Special Pose is in effect."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Gamma Blaster / Full Burst",
        "desc": "Use a ray gun to fire scattered shots in a set direction.\nCan move or redirect while attacking.\nMore DMG is dealt while Special Pose is in effect."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Special Pose",
        "desc": "Strike a hero's pose and create an explosion around yourself.\nRestore HP and gain Immune to All when activated.\nFor a set period, Gamma 1 and Gamma 2 fight together, combine their HP, gain increased Rush Attack range, and turn their Rush Attacks and regular Skills into combination attacks.\nCore Breaker becomes available at Skill Level 3 (Super)."
      },
      {
        "id": "super_attack2",
        "type": "super_attack",
        "name": "Core Breaker",
        "desc": "As Gamma 2, rush in for a last-ditch attack at a set position.\nCan only be activated once per battle during a Skill Level 3 (Super) Special Pose.\nDrains the base HP of Gamma 2 to 0 when activated and forces Gamma 1 to swap in."
      }
    ]
  },
  "0024": {
    "id": "0024",
    "difficulty": "40",
    "description": "A mischievous hero who uses ghosts to obstruct foes! \nFinish the fight with Super Ghost Kamikaze Attack and show them what you're really made of!",
    "statsPath": "M 100.0 40.0 L 115.6 87.5 L 178.0 117.8 L 143.4 190.1 L 78.3 145.0 L 70.8 106.7 L 68.7 75.1 L 100.0 40.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Exaltation",
        "desc": "Applies Movement Speed Up to self and nearby ally heroes when KOing or assisting against an enemy hero."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "Fire an energy blast. \nDeals more DMG to enemies with a debuff."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Hyper Ultra Super Combo",
        "desc": "Warp to an enemy's location and perform a combo attack.\nApplies Strike Defense Up to self during the combo.\nAlso attacks enemies nearby, finishing by staggering them and warping back to where the Skill was activated.\nThe number of combo hits increases with Skill level."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Galactic Donut",
        "desc": "Throw a donut-shaped ring at a set position that gathers enemies together."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Super Ghosts",
        "desc": "Summon ghosts to a set target.\n- Enemy or Dragon Shell: Pursue the target for a limited period and explode on hit, applying Movement Speed Down.\n- Self or ally hero: Follow the target.\n- No Target: Wait at the set position.\nGhosts that are following or waiting pursue enemy heroes who draw near.\nGhosts that are pursuing or waiting explode and disappear if hit by an enemy attack or upon hitting a wall."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Super Ghost Kamikaze Attack",
        "desc": "Send ghosts rushing toward a set position.\nGhosts pursue enemy heroes and apply No Skills/Attacks to enemies hit with their last strike."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Saiyan",
        "desc": "Can transform at Level 7.\nBase HP / All Attack Up."
      }
    ]
  },
  "0025": {
    "id": "0025",
    "difficulty": "0",
    "description": "A God of Destruction who deals constant damage through branding enemies with the Mark of Destruction.\nSeize victory for your team by denying enemies their escape and steadily whittling away their strength!",
    "statsPath": "M 100.0 70.0 L 178.2 37.7 L 148.7 111.1 L 104.3 109.0 L 82.6 136.0 L 51.3 111.1 L 60.9 68.8 L 100.0 70.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "I Won't Be Fighting for Justice Any Longer...",
        "desc": "Applies Movement Speed Up to self when moving towards enemies with the Mark of Destruction.\nThe effect is greater the more Mark of Destruction stacks there are."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nExtends the duration of Mark of Destruction and shortens Skill cooldowns (Super Attacks excluded) when hitting an enemy with Mark of Destruction.\nShortens cooldowns more when the target is an enemy hero.\nThe more Mark of Destruction stacks there are, the more cooldowns are shortened."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Destructive Flash",
        "desc": "Fire a barrage of energy blasts in a set direction.\nApplies Mark of Destruction to enemies hit. Can move while attacking."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Demolition Tornado",
        "desc": "Rapidly rotate to deal a series of strike attacks to the surrounding area.\nApplies Mark of Destruction to enemies hit and deals more DMG the more Mark of Destruction stacks they have. Restore base HP after dealing DMG to an enemy. Can move while attacking."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Sphere of Destruction: Tempered",
        "desc": "Assume a fighting stance and unleash an unavoidable energy blast against nearby enemies who attack during it. Applies Mark of Destruction to enemies hit.\nGain extra HP, Energy Defense Up, and No Obstruction while maintaining the stance.\nThe more you are attacked while in this stance, the more DMG dealt."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Massive Sphere of Destruction",
        "desc": "Unleash a sphere filled with destructive energy at a set position.\nThe sphere contracts on impact, finishing with an explosion that deals extra DMG.\nIf the explosion hits an enemy with Mark of Destruction, it deals additional DMG according to the number of stacks. Mark of Destruction stacks are not consumed."
      }
    ]
  },
  "0027": {
    "id": "0027",
    "difficulty": "60",
    "description": "A playmaker who separates his target from the pack, creating advantages for his allies.\nTake down isolated enemies one by one alongside your team!",
    "statsPath": "M 100.0 60.0 L 123.5 81.3 L 148.7 111.1 L 134.7 172.1 L 69.6 163.1 L 41.5 113.4 L 53.1 62.6 L 100.0 60.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "You Can't Win...",
        "desc": "Stagger and weaken an enemy hero.\nApplies a stack to an enemy hero on hit.\nWhen stacks are maxed out, target becomes a Break Target and any damage dealt staggers them, applying Physical Defense Down and Energy Defense Down.\nRush Attacks and Skills (Super Attacks excluded) have a moderate effect, with Super Attacks having a greater effect."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nBecomes a powered-up attack with increased DMG against Break Targets."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Jack Blast",
        "desc": "Unleash a strike in a set direction.\nThe strike applies a stack and Energy Defense Down to enemy heroes hit. Re-entering the command within a set window unleashes an energy wave that pushes enemies away, deals extra DMG, and applies an additional stack and Strike Defense Down to enemy heroes hit.\nThe closer an enemy is, the farther they are pushed. When enhanced by Power Unleashed, pushback increases and both defense-reduction effects become stronger."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Rolling Hammer",
        "desc": "An unavoidable attack that warps to the target location and forcibly moves the target in the direction you warped from.\nGenerates a shockwave on hit, dealing additional DMG to non-target enemies.\nApplies a stack to enemy heroes hit.\nStaggers and deals extra DMG to targets knocked into a wall or another hero.\nWhen enhanced by Power Unleashed, the target is sent flying, enemies hit by the shockwave are forcibly moved, and collision DMG is increased."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Power Unleashed",
        "desc": "Unleash a shockwave around yourself, applying Flee to enemies.\nApplies a stack to enemy heroes hit.\nWithin a set window after activation, Jack Blast and Rolling Hammer are enhanced and can be used even while on cooldown."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Mach Break",
        "desc": "Warp to the target location and unleash a flurry of attacks while moving at high speed.\nThe first hit to enemy heroes applies a stack to them. Can move while attacking.\nGenerates a shockwave following the flurry, staggering enemy heroes with stacks, and applying Flee to enemies without stacks."
      }
    ]
  },
  "0028": {
    "id": "0028",
    "difficulty": "0",
    "description": "A raging hero who doles out despair with Fiendish Tenacity. \nLet misery fall upon foes near and far as you unleash overwhelming power upon them.\nThe bloodbath awaits!",
    "statsPath": "M 100.0 50.0 L 131.3 75.1 L 187.7 120.0 L 104.3 109.0 L 87.0 127.0 L 51.3 111.1 L 37.5 50.1 L 100.0 50.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Fiendish Tenacity",
        "desc": "Increases the Despair Gauge of enemy heroes when Skills land.\nGain Strike Defense Up and Energy Defense Up against enemy heroes whose Despair Gauge is active, and deal increased Rush Attack DMG according to the gauge level.\nThe more enemies a single attack hits, the more the gauge increases. Dragon Shell is counted as an enemy for this calculation.\nThe gauge decreases after not damaging the target for a set period or after taking Rush Attack DMG from that enemy hero."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nThe higher the Despair Gauge, the more DMG is dealt.\nMaintains the Despair Gauge level during the attack."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Gigantic Knuckle",
        "desc": "Pummel the ground and split the earth in a set direction.\nThe more the attack is charged, the greater the AoE.\nCan move/redirect while charging.\nIncreases the Despair Gauge of any enemy heroes hit."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Gigantic Stomp",
        "desc": "Leap up and stomp the ground at a targeted position.\nApplies Unstoppable to self during the attack.\nAny enemy hit by this Skill will be stomped on several times, and the Despair Gauge of enemy heroes hit will increase.\nCan move/redirect following the initial stomp."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Roar",
        "desc": "Unleash a ferocious roar in a set direction.\nUpon activation, immediately removes the cooldown on all other Skills (Super Attack excluded).\nDMG dealt by the next activated Skill (Roar excluded) will be increased, and the Despair Gauge of enemy heroes hit will increase.\nCooldown on this Skill will increase in proportion to the amount of cooldown removed from other Skills."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Blaster Meteor",
        "desc": "Fire explosive energy blasts into the surroundings while cloaked in energy.\nCan move while attacking, and if enemies are nearby, energy blasts will target them and explode.\nApplies Movement Speed Down to enemies hit by the explosions.\nIncreases the Despair Gauge of enemy heroes hit by explosions or the cloak of energy."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Legendary Super Saiyan",
        "desc": "Can transform at Level 7.\nBase HP / All Attack Up."
      }
    ]
  },
  "0032": {
    "id": "0032",
    "difficulty": "40",
    "description": "A divine hero that can rain down damage across vast distances.\nRaise your Red Fury in battle and pressure your enemies with unrelenting attacks!",
    "statsPath": "M 100.0 50.0 L 178.2 37.7 L 129.2 106.7 L 113.0 127.0 L 82.6 136.0 L 51.3 111.1 L 53.1 62.6 L 100.0 50.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Red Fury",
        "desc": "Gain buffs by increasing Red Fury.\nHitting enemy heroes with Skills (excluding Dragon Enhance and Super Attacks) and Rush Attacks increases Fury, which decreases over time while not in combat.\nWhen maxed out, buffs to self activate and the remaining cooldowns of Skills, excluding Super Attacks, are reduced.\nWhile buffed, DMG dealt with Skills is increased and Cooldown Reduction is applied to self.\nFury no longer increases while buffed, and the power-up ends when it reaches 0."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nCan attack through walls."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Arcane Shot",
        "desc": "Fire energy blasts with both hands at a set position.\nThe further away the target, the more the energy blasts hone in.\nAt Skill Level 3 (Super), the number of energy blasts increases, and enemies hit by 2 or more blasts will be afflicted with Movement Speed Down.\nDMG is increased while buffed by Red Fury."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "God Shoot",
        "desc": "Continuously releases a linear beam of energy in a set direction.\nCan move/redirect while firing, and DMG will gradually increase over a set period of time after the attack begins.\nThe Skill ends and the increased DMG effect resets upon re-entering the command, using Vanishing Step, activating another Skill, or when the cooldown timer reaches 0.\nCan be continuously activated and DMG is increased while buffed by Red Fury."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Dragon Enhance",
        "desc": "Release a dragon of energy.\nWhile active, extends the range of Rush Attacks, gives Arcane Shot the ability to penetrate enemies, and gives God Shoot the ability to penetrate walls.\nThe closest enemy first struck by another Skill is inflicted with Burning, receiving additional damage.\nThe effect ends either when another Skill is used or when a set amount of time has passed.\nWhile buffed by Red Fury, the greater the Burning effect and the greater the additional DMG."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "God Kamehameha",
        "desc": "Unleash a powerful energy wave from above a set position.\nBecomes findable by enemy heroes during the attack.\nAt Skill Level 3 (Super), range extends to the entire stage.\nDMG is increased while buffed by Red Fury."
      }
    ]
  },
  "0034": {
    "id": "0034",
    "difficulty": "60",
    "description": "A wicked hero who scatters Parts around to weaken enemies.\nSpawn Clones from these Parts to harass enemies and dominate the battlefield!",
    "statsPath": "M 100.0 70.0 L 123.5 81.3 L 178.0 117.8 L 143.4 190.1 L 87.0 127.0 L 70.8 106.7 L 68.7 75.1 L 100.0 70.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Mystic Body",
        "desc": "Create Parts.\nEach time your base HP is reduced by a certain percentage of its max value, Parts will scatter around you.\nApplies Movement Speed Down to enemies in range of the Parts."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nParts within the AoE transform into Clones, applying All Defense Down and dealing additional DMG to enemies."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Arm Ball",
        "desc": "Throw Parts at a targeted location.\nParts will scatter around the area of impact.\nThe amount scattered increases with Skill level."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Leg Hook",
        "desc": "Stretch your leg in a targeted direction, grabbing an enemy.\nIf the attack lands, the enemy is pulled in close, briefly held, and then headbutted, staggering them and dealing additional DMG.\nIf there are Parts near the target, range is increased."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Noisy Chest Drumming",
        "desc": "Furiously beat your chest.\nUpon activation, gains extra HP.\nCan move while attacking and applies Movement Speed Down to enemies hit.\nIf there are any Parts within the AoE, they will transform into Clones and deal additional attacks.\nAoE and DMG increases based on how many Clones there are.\nAlso, Movement Speed Down effect strength and amount of additional HP gained will increase incrementally.\nThe attack ends on re-input, use of another Skill, or use of Vanishing Step."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Earth Breaker",
        "desc": "Drop down an energy blast upon a targeted location.\nOn activation, Parts in range will transform into Clones, grabbing nearby enemies and applying Movement Speed Down.\nOn detonation, a shockwave is generated applying All Defense Down to enemies.\nAlso on detonation, an area is created that deals additional DMG and applies All Attack Down to enemies.\nWill transform into Parts while this area exists, applying Immune to All to self.\nTransformation will end upon re-input, or after a set amount of time."
      }
    ]
  }
};
