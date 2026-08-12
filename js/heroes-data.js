// Automatically scraped hero detail database with approved final-state patch-note corrections.
export const HEROES_DATA = {
  "0040": {
    "id": "0040",
    "difficulty": "20",
    "description": "A hero of conviction who takes reduced DMG from the front, and grows stronger the longer he fights.\nUse the range and AoE of your Skills to dominate the battlefield and prove your righteousness!",
    "statsPath": "M 100.0 50.0 L 146.9 62.6 L 139.0 108.9 L 130.4 163.1 L 87.0 127.0 L 31.8 115.6 L 45.3 56.4 L 100.0 50.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Strength Is Justice",
        "desc": "Gain increased strength with continued fighting.\nReduces frontal DMG while in combat.\nDMG reduction gradually increases the more he fights.\nDMG reduction decreases when receiving DMG from behind by an enemy hero.\nDMG reduction effects are nullified while obstructed.\nEnters a powered-up state when DMG reduction is maxed, applies Movement Speed Up to self, and Rush Attacks become powered-up attacks, effect ends after leaving combat."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nIf Strength Is Justice DMG reduction is at maximum, becomes a powered-up attack, and number of hits, range, and DMG increase."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Heat Ball Shot",
        "desc": "Fire a penetrating energy blast in a set direction.\nDeals more DMG the more DMG reduction he has from Strength Is Justice.\nAt Skill Level 3 (Super), number of blasts increases."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Colossal Uppercut",
        "desc": "Perform an uppercut in a set direction, generating a shockwave.\nWhile powered up by Strength Is Justice, applies Burning to enemies.\nEnemies struck by the uppercut will be launched upwards.\nCan move prior to performing the uppercut."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Maximum Impact",
        "desc": "Unleash an energy wave in a set direction.\nExtra HP is gradually gained, Strength Is Justice's DMG reduction increases, and can move/redirect in this stance.\nFire an energy wave on re-input or after a set amount of time.\nThe attack penetrates walls and enemies, applying Movement Speed Down.\nThe longer the time before firing, the greater the Movement Speed Down effect and DMG dealt."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Omega Heatwall",
        "desc": "Burn everything down in a set direction and create a wall of flames.\nWall will expand sideways, pushing away and applying Burning to enemies as it moves.\nCertain skills cause enemies hit by the moving wall to be staggered.\nThe wall disappears after moving a certain distance.\nCan be learned after transforming."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Full Power",
        "desc": "Can transform at Level 7.\nBase HP / Armor / All Attack Up."
      }
    ]
  },
  "0039": {
    "id": "0039",
    "difficulty": "80",
    "description": "A dark hero who fights by creating situations advantageous to him.\nWeaken enemies while restricting their movements, dominate the front lines, and build a utopia!",
    "statsPath": "M 100.0 50.0 L 146.9 62.6 L 168.2 115.6 L 134.7 172.1 L 82.6 136.0 L 51.3 111.1 L 53.1 62.6 L 100.0 50.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Path to the Divine",
        "desc": "Gain increased strength within a certain area.\nShortens Skill cooldowns (Super Attacks excluded) at set intervals when inside an area created by his or an allied hero's Skill that applies healing or status effects."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nAttacks are powered up, and the number of hits increases when inside an area he has created."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Black Kamehameha",
        "desc": "Unleash an energy wave in a set direction.\nApplies Movement Speed Up to allied heroes hit, and Movement Speed Down and High Pressure to enemies.\nCreates an area that applies Movement Speed Up to self and allied heroes and Movement Speed Down and High Pressure to enemies inside it.\nThe more DMG he takes inside the area, the shorter the area's duration."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Black Break",
        "desc": "Dash in a set direction, then fire energy all around.\nCreates an area while energy is released, applying All Defense Up to self and allied heroes, and All Defense Down to enemies inside it.\nThe AoE will gradually increase based on the number of allied and enemy heroes hit.\nThe more DMG he takes inside the area, the shorter the area's duration."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Black Bind",
        "desc": "Envelop enemies in an energy wave at a set location and forcibly move them based on directional input.\nApplies Immune to All to self if inside one of his own areas.\nDuration increases if he or the target is inside his area.\nIf targets are in his areas after being forcibly moved, that area explodes, staggering and dealing extra DMG.\nExploded areas will disappear (excluding areas created by Black Power Ball).\nCan move while forcibly moving."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Black Power Ball",
        "desc": "Strike with an energy blast at a set location.\nCreates an area and applies Base HP/Armor Decrease to enemies within the AoE upon impact."
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
  "0005": {
    "id": "0005",
    "difficulty": "60",
    "description": "A tactical hero who uses elastic arms and energy blast traps to control the flow of battle.",
    "statsPath": "M 100.0 10.0 L 140.7 67.6 L 158.5 113.4 L 108.7 118.0 L 78.3 145.0 L 49.3 111.6 L 84.4 87.5 L 100.0 10.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Opening Move Toward Victory",
        "desc": "Attacking enemies with a Rush Attack will instantly lower cooldown on Skills."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nThe fifth consecutive attack, or an attack after Demon Whip, will be powered up and deal more DMG."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Light Grenade",
        "desc": "Fire a powerful energy blast. At Skill Level 2, an explosion will occur at the point of impact. DMG and AoE of explosion increases the further away a target is."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Hellzone Trap",
        "desc": "Launch a field of energy orbs into the air. \nFloating orbs will target approaching enemies. If the Skill is used again or a certain amount of time passes, any remaining orbs will drop to the ground.\nOrbs explode upon contact, applying Movement Speed Down to enemies hit by the explosion."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Demon Whip",
        "desc": "Stretch out an arm and immediately move to any enemy, ally hero, or wall that you touch.\nAfter moving, your next Rush Attack will release a powerful energy blast and your DMG will increase."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Special Beam Cannon",
        "desc": "A beam of energy that penetrates enemies and walls. Holding down the attack button will expend stocks. The more stocks used, the higher the DMG and range."
      }
    ]
  },
  "0004": {
    "id": "0004",
    "difficulty": "40",
    "description": "A hero who cuts down enemies in an instant by reactivating Skills with Overcharge! ",
    "statsPath": "M 100.0 0.0 L 131.3 75.1 L 148.7 111.1 L 115.6 132.4 L 69.6 163.1 L 49.3 111.6 L 84.4 87.5 L 100.0 0.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Overcharge",
        "desc": "Skills on cooldown can be reactivated immediately upon defeating, or assisting an ally in defeating, an enemy, God of Destruction, or boss."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A sword-based attack."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Burst Sword",
        "desc": "Unleash a powerful sword thrust. DMG is further increased against enemies whose HP is below a certain percentage."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Vanish Strike",
        "desc": "Warp to the target location and perform a slashing attack with your sword. Can warp past walls."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Burning Attack",
        "desc": "Fire an energy blast. Explodes at the point of impact and generates Smoke."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Shining Slash",
        "desc": "An attack that combines slashes with an energy wave. Gain Movement Speed Up afterwards. Can change direction while attacking."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Saiyan",
        "desc": "Can transform at Level 7. Raises base HP and all attack power."
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
  "0014": {
    "id": "0014",
    "difficulty": "60",
    "description": "A long-range hero who controls Ki in the form of a Cyclone.",
    "statsPath": "M 100.0 60.0 L 170.4 43.9 L 158.5 113.4 L 108.7 118.0 L 65.3 172.1 L 80.5 104.5 L 76.5 81.3 L 100.0 60.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Cyclone Stream",
        "desc": "Gain Cyclone when you activate certain Skills or your Super Attack.\nExpend Cyclone when performing a Rush Attack to gain an additional attack.\nCyclone will gradually deplete over time."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nGradually expends Cyclone upon activation for homing blasts that deal more DMG."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Rage Barrage",
        "desc": "Fire multiple energy blasts that fan out in a targeted direction.\nGain Cyclone on activation, and gains additional Cyclone upon hitting enemies.\nCan move while using this Skill."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Brutal Buster",
        "desc": "Generate a shockwave around yourself. For a set time, Rush Attack speed will increase, and the range of Rush Attack and Skill 3 will increase.\nYou will gain the Unstoppable effect."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Shooting Chaser",
        "desc": "After dashing in a certain direction, fire energy blasts at enemies in the area.\nGain Cyclone upon hitting enemies."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Cyclone Burst",
        "desc": "Expend all stored Cyclone to unleash a huge energy attack in a certain direction.\nDMG increases based on Cyclone amount at activation.\nGain Cyclone upon hitting enemies.\nEnemy heroes below a certain amount of HP when hit, will be inflicted with Candy status."
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
  "0013": {
    "id": "0013",
    "difficulty": "20",
    "description": "An offensive-type hero who nullifies enemy attacks.",
    "statsPath": "M 100.0 60.0 L 131.3 75.1 L 158.5 113.4 L 130.4 163.1 L 78.3 145.0 L 41.5 113.4 L 45.3 56.4 L 100.0 60.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Imperial Retaliation",
        "desc": "Gain Immune to All when activating Skills.\nWhen an enemy hero lands an attack while Immune to All, your next Skill will be enhanced with Retaliation status.\nWhile Retaliation is in effect, the next Skill used will be enhanced."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nWhile Retaliation is in effect, DMG is increased."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Destruction Ray",
        "desc": "Fire a beam that deals Continuous Damage."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Death Stopper",
        "desc": "Create an AoE around you that applies High Pressure and Movement Speed Down.\nApplies Stagger to dashing enemies.\nIf used while Retaliation status is active, the duration will be extended."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Death Chaser",
        "desc": "Perform a lunging attack.\nIf used while Retaliation status is active, the enemy will be held and dragged, slammed against the ground, and Movement Speed Down will be applied."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Atomic Supernova",
        "desc": "Unleash an enormous energy ball. Enemies are pulled towards the center of the attack.\nIf Retaliation is active, the range enemies are pulled from will be increased."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Final Form",
        "desc": "Can transform at Level 7. Imperial Retaliation will be enhanced, extending the duration of Retaliation status."
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
  "0018": {
    "id": "0018",
    "difficulty": "60",
    "description": "A hero who transforms and powers up into Perfect Form by absorbing Bioenergy from enemies! ",
    "statsPath": "M 100.0 70.0 L 131.3 75.1 L 139.0 108.9 L 126.0 154.1 L 82.6 136.0 L 22.0 117.8 L 29.6 43.9 L 100.0 70.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Bioenergy",
        "desc": "Base HP, armor, and all attack power increases the more Bioenergy you absorb."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "Attacks become Drain attacks when enemy HP is below a certain percentage, for a set period of time after an enemy is obstructed, or when performing a Finisher."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Big Bang Crash",
        "desc": "Fire an energy blast. After the blast hits, it will explode after a set period and apply Movement Speed Down to enemies."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Raid Smash",
        "desc": "Warp to a target and deliver a strike attack.\nGrabs the target in a chokehold/Grabs hold of the target and staggers them if attacking from behind."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Regeneration",
        "desc": "After charging up power, unleash an explosion around yourself and then regenerate.\nExplosion occurs when command is re-entered, or a set amount of time has passed. Applies Movement Speed Down to enemies hit from the front.\nRegenerates and heals HP after the explosion.\nAmount of HP healed increases based on how low HP is at the time of the explosion and the amount of DMG taken while charging up power.\nCan move while charging.\nAt Skill Level 3 (Super), removes debuffs when regenerating."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Energy Field",
        "desc": "Attack while surrounding yourself with a barrier. The barrier will block energy attacks from the outside, while you and any ally heroes within the barrier will gain Immune to Energy."
      },
      {
        "id": "super_attack2",
        "type": "super_attack",
        "name": "Energy Field: Duel",
        "desc": "Attack while surrounding yourself with a barrier. The barrier will block energy attacks from the outside, while you and any ally heroes within the barrier will gain Immune to Energy. \nIf there are enemy heroes within the barrier when the barrier effect ends, a ring will appear and restrain the closest enemy hero.\nOther enemy heroes cannot enter the ring. Applies All Defense Up to self."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Perfect Form",
        "desc": "Transform once Bioenergy reaches maximum. Base HP, Armor, and All Attack will increase."
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
  "0023": {
    "id": "0023",
    "difficulty": "40",
    "description": "A versatile hero who uses Instant Transmission to shake up foes with hit-and-run tactics. \nFire high-powered attacks from a distance and show off your Super Saiyan might!",
    "statsPath": "M 100.0 20.0 L 123.5 81.3 L 187.7 120.0 L 113.0 127.0 L 82.6 136.0 L 70.8 106.7 L 68.7 75.1 L 100.0 20.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "If I Won't Do It, Who Will?!",
        "desc": "An ability that grants buffs in adverse situations.\nDeals more DMG to enemy heroes who have a higher percentage of HP than yourself."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "Fire an energy blast.\nBecomes a powered-up attack with increased DMG at set intervals, and causes an explosion on impact that deals additional DMG."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Super Kamehameha",
        "desc": "Unleash an energy wave in a set direction.\nRange and duration increase the longer the attack is charged.\nDistance will not reduce DMG dealt if charged to max.\nCan move/redirect while charging, and can redirect while firing."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Explosive Strike",
        "desc": "Quickly move to a set position in the sky above and store an energy blast in your fist before rushing at enemy.\nDeals more DMG the less HP the enemy has.\nRe-enter the command to quickly move back to the location the Skill was activated."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Instant Transmission",
        "desc": "Teleport to a set target.\nAble to target discovered enemy/ally heroes.\nCooldown of this Skill is shortened if an enemy hero is targeted.\nBecomes Instant Transmission Kamehameha if Super Kamehameha is activated immediately after use, allowing for a fully charged Super Kamehameha."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Dragon Fist",
        "desc": "Release a dragon of energy from your fist in a set direction.\nCan be mastered while transformed."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Saiyan 3",
        "desc": "Can transform at Level 7.\nBase HP / All Attack Up.\nDMG dealt by If I Won't Do It Who Will?! will increase."
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
  "0021": {
    "id": "0021",
    "difficulty": "80",
    "description": "A hero with two natures. Though normally supporting allies from the shadows, she will wreak havoc on the front lines when going berserk. ",
    "statsPath": "M 100.0 10.0 L 115.6 87.5 L 168.2 115.6 L 113.0 127.0 L 87.0 127.0 L 70.8 106.7 L 76.5 81.3 L 100.0 10.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Courage for Comrades",
        "desc": "Boosts DMG dealt by Skills activated at an ally hero's position (Super Attacks excluded)."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "Fire an energy blast.\nDeals more DMG when activated near an ally.\nBecomes a physical strike attack when transformed into Super Saiyan (Berserk).\nThe third consecutive attack will be powered up an deal increased DMG."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Blaster Shot",
        "desc": "Fire a barrage of energy blasts that explode upon impact.\nCan move while attacking."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Charge Force",
        "desc": "Fire a long-range energy blast.\nDeals more DMG to enemies who are further away.\nAoE, range, and DMG dealt will increase the longer it is charged.\nCan move or redirect while charging."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Energy Sphere",
        "desc": "Fire a slow-moving energy blast that gradually grows in size.\nIf Charge Force hits the blast, it explodes in a horizontal direction. If Blaster Shot hits the blast, it explodes in a dome shape and deals extra DMG."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Broken Evolution",
        "desc": "Unleash volatile energy and generate a surrounding shockwave.\nTransform into Super Saiyan (Berserk) upon activation.\nGain No Attack Obstruction effect and extra HP.\nRush Attacks will change, and you will not be able to use Skills.\nVanishing Steps will change into a forward lunge with an attack that staggers enemies."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Saiyan (Berserk)",
        "desc": "Activate Broken Evolution to transform. Effect is canceled after a set period or after extra HP is used up."
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
  "0029": {
    "id": "0029",
    "difficulty": "20",
    "description": "The ultimate fusion (merged) warrior, he rains down chaos with his high mobility and wide-ranging Skills.\nTake the battlefield by storm with his lightning speed!",
    "statsPath": "M 100.0 40.0 L 131.3 75.1 L 158.5 113.4 L 108.7 118.0 L 69.6 163.1 L 51.3 111.1 L 60.9 68.8 L 100.0 40.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Shining Fusion (Merged Warrior)",
        "desc": "Deals extra energy damage and gains extra HP when skills or powered-up attacks hit two or more enemies at the same time.\nThe more enemies hit, the more extra HP gained.\nThe cooldown time for this ability is shortened when Skills or powered-up attacks hit an enemy. \nThe more enemies hit, the more the cooldown time is reduced."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nThe third attack is a powered-up energy AoE attack."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Spirit Sword",
        "desc": "Use a sword to slash at the surrounding area.\nCooldown time is reduced on enemy hit.\nHitting an enemy hero reduces the cooldown time by a greater amount.\nCombine with Flash Dodge to be able to move during activation."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Flash Dodge",
        "desc": "Take off in pursuit of a targeted enemy.\nRe-enter the command while using the Skill to reactivate it.\nIf you target a previously untargeted enemy hero during reactivation, the input limit and timespan for reactivation will increase."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Finger Shot",
        "desc": "Lock onto nearby enemies and fire explosive energy blasts.\nApplies Movement Speed Down to enemies hit by the explosion.\nActivate Flash Dodge to remain locked on while moving."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Spirit Excalibur",
        "desc": "Cut a cross-shaped slash at a set position.\nPowers self up after attack and increases the speed of Rush Attacks.\nAlso, Skill cooldowns (Super Attacks excluded) will instantly end/shorten.\nWhile powered-up, Skills (Super Attacks excluded) and powered-up attacks fill the Intensity Gauge upon hitting enemies.\nThe Super Attack can be reactivated when the gauge is full.\nThe gauge gradually depletes over time, and power-ups are removed when the gauge reaches 0 or is not filled to the maximum amount after a set amount of time has passed."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Vegito",
        "desc": "Can transform at any time.\nBase HP / All Attack Up\nEXP earned from enemy NPCs is normally low, but EXP required to reach the next level is earned upon transformation, leveling up by 1."
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
  "0030": {
    "id": "0030",
    "difficulty": "20",
    "description": "A hero who will quickly dash in to save comrades in a pinch. \nProtect allies by drawing in attacks and launching an explosive counterattack with your amassed power!",
    "statsPath": "M 100.0 40.0 L 131.3 75.1 L 148.7 111.1 L 130.4 163.1 L 82.6 136.0 L 12.3 120.0 L 37.5 50.1 L 100.0 40.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Rebel Warrior",
        "desc": "An ability that strengthens self based on attacks received. \nThe Revenge Gauge fills up each time DMG is taken, and DMG taken will be reduced based on gauge level.\nThe gauge gradually depletes if no DMG is taken for a set period."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nRush Attack movement speed increases based on Revenge Gauge level.\nWhen the gauge is maxed out, the number of attacks will decrease, but they become AoE attacks with increased DMG until the gauge reaches zero."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Rebellion Smash",
        "desc": "A guaranteed attack that sends targeted enemy and sends them flying.\nIf this enemy hits a wall or another foe, they will both receive extra DMG and have Movement Speed Down applied."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Wild Roar",
        "desc": "Invite enemy aggression while guarding and unleash counterattacks.\nGenerates a surrounding shockwave that applies Wrath to enemies it hits.\nThe more enemy heroes with Wrath applied to them, the more Extra HP gained.\nFurther surrounding shockwaves will be generated each time DMG is taken while guarding.\nCan move while guarding. Re-enter the same command, activate a different Skill, or perform a Vanishing Step to stop guarding."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Raging Charge",
        "desc": "Move at high speed in a set direction to get to your allies.\nEnemy heroes or bosses in the movement path will be attacked with an uppercut, applying Movement Speed Down to them.\nAfter moving a set distance, enemies will be staggered by the attack. Stagger duration and DMG dealt by the uppercut increase the further you move.\nCan redirect while moving. Stops upon re-entering of the same command, or hitting a wall."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Riot Javelin",
        "desc": "Fire an energy blast in a set direction.\nThe blast carries the enemy heroes it hits and explodes after a set amount of time has passed, or after hitting a wall."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Saiyan",
        "desc": "Can transform at Level 7.\nBase HP / Armor / All Attack Up.\nThe Revenge Gauge amount gained from Rebel Warrior will increase, and gauge power-up effect time will be extended."
      }
    ]
  },
  "0026": {
    "id": "0026",
    "difficulty": "20",
    "description": "A stalwart hero who bolsters defenses while blocking enemy attacks. \nDrive back foes with Final Shine Attack and protect your team!",
    "statsPath": "M 100.0 40.0 L 131.3 75.1 L 158.5 113.4 L 121.7 145.0 L 74.0 154.1 L 22.0 117.8 L 21.8 37.7 L 100.0 40.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Solitary Guardian",
        "desc": "Applies Strike Defense Up to self when forcibly moving an enemy hero with a Skill (Barrier Wall excluded)."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A physical attack.\nBecomes a powered-up attack with increased DMG for a set period when he forcibly moves an enemy hero with a Skill (Barrier Wall excluded)."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Blast Jump",
        "desc": "Leap at a set position to strike down with a fist. \nIf this attack hits, it will pull enemies in."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Meteor Extrusion",
        "desc": "Drive back enemies with a flying kick in a set direction. \nStaggers and deals extra DMG to enemies driven into a wall.\nThe attack will end upon hitting a wall."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Barrier Wall",
        "desc": "Create a barrier in front and drive back enemies.\nYou can move/redirect while the barrier is active and block energy wave attacks (excludes AoE attacks).\nYou will gain the Unstoppable effect and extra HP.\nObtains a greater amount of extra HP the higher your maximum total HP.\nAttack ends when the command is re-entered while attacking or extra HP runs out.\nEnding it by re-entering the command will shorten this Skill's cooldown relative to how long the Skill was active."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Final Shine Attack",
        "desc": "Fire an energy wave in a set direction and drive back enemies.\nCan redirect during attack. Re-enter the command to cancel."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Saiyan 4",
        "desc": "Can transform at Level 7.\nBase HP / All Attack / Solitary Guardian Effect Up."
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
  },
  "0035": {
    "id": "0035",
    "difficulty": "20",
    "description": "A dominator of the battlefield who limits enemy movement with wide-reaching walls.\nBlast enemies in the back as they run away in terror, then while they're weakened, send every last one off to Hell!",
    "statsPath": "M 100.0 60.0 L 123.5 81.3 L 139.0 108.9 L 139.0 181.1 L 87.0 127.0 L 41.5 113.4 L 60.9 68.8 L 100.0 60.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Hellbound",
        "desc": "An ability that increases power against back-turned enemy heroes.\nIf positioned behind an enemy's back while attacking, they will receive additional DMG."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nBecomes a powered-up attack if the enemy's HP is below a certain amount, dealing increased DMG."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Death Beam",
        "desc": "Fire a beam that penetrates walls in a targeted direction. \nDMG will be reduced from the second enemy hit onward."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Psychokinetic Grasp",
        "desc": "Seize control of space-time at a targeted location.\nApplies Immobile to enemies on hit.\nCan move while attacking."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Psychokinetic Rock",
        "desc": "Drop rocks on the targeted location, creating a wall.\nThe wall can be destroyed with attacks, and will collapse upon re-inputting the Skill or after a set amount of time passes.\n\nWall durability and number of rocks increase with Skill level.\nAt Skill Level 3 (Super), rocks increase in size.\nCan move while attacking."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Earth Splitter",
        "desc": "Split the earth at a targeted location.\nCreates an energy wall that blows away enemies and deals DMG when touched."
      }
    ]
  },
  "0031": {
    "id": "0031",
    "difficulty": "60",
    "description": "An aggressive hero who uses Vanishing Steps to attack a large area.\nStrike as many foes as you can and set the battle alight!",
    "statsPath": "M 100.0 70.0 L 139.1 68.8 L 178.0 117.8 L 104.3 109.0 L 61.0 181.1 L 70.8 106.7 L 84.4 87.5 L 100.0 70.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "A Hard-Knuckled Fight",
        "desc": "Shortens the cooldown time of Vanishing Step when an attack lands.\nIncreases the damage dealt by Skills (excluding Super Attacks) after Vanishing Step is used."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack that targets multiple enemies.\nDeals more damage to the main target."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Blaster Ball",
        "desc": "Fires a barrage of energy blasts that causes an explosion at a set position. \nCan move, adjust targeted position, and use Vanishing Step while attacking."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Gigantic Breaker",
        "desc": "Fire an energy blast in a set direction.\nRange and speed of the blast increase the more the attack is charged.\nCan move, redirect, and use Vanishing Step while charging.\nCan be activated without charging and at maximum range while A Hard-Knuckled Fight is active."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Full Voltage",
        "desc": "An attack that releases energy all around her.\nApplies Movement Speed Boost to self after the attack.\nIncreases damage dealt to all targets during a rush attack and applies Movement Speed Boost to self.\nThe more enemies hit, the greater the effect of Movement Speed Boost and the longer the duration of this Skill."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Gigantic Twin Blast",
        "desc": "Fires two energy attacks in a set direction.\nCan move, redirect, and use Vanishing Step while attacking."
      },
      {
        "id": "transformation1",
        "type": "transformation",
        "name": "Super Saiyan 2",
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
  "0033": {
    "id": "0033",
    "difficulty": "40",
    "description": "A divine guardian who supports his team by drawing enemy attention on the frontlines.\nRaise your Red Fury in battle, create attack openings, and seize victory!",
    "statsPath": "M 100.0 80.0 L 154.7 56.4 L 158.5 113.4 L 108.7 118.0 L 69.6 163.1 L 31.8 115.6 L 53.1 62.6 L 100.0 80.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Red Fury",
        "desc": "Gain buffs by increasing Red Fury.\nHitting enemy heroes with Rush Attacks and Skills (excluding Super Attacks) increases Fury.\nWhen maxed out, buffs to self are activated, and Skill cooldowns are reduced.\nWhile buffed, gradually recover Armor and apply Cooldown Reduction to yourself.\nThe power-up ends if you take DMG from enemy heroes or when Fury reaches 0."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nDMG increases if you have Armor."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Prominence Blow",
        "desc": "Charge forward in a set direction.\nApplies Steal Attack on hit to self and the enemy, stealing the enemy's attack power and adding it to your own.\nThe higher the enemy hero's attack power, the greater the effect."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Divine Zone",
        "desc": "Unleash energy pulses into the surrounding, pulling in enemies several times.\nThe final wave has a stronger pull.\nActivating God Shine Attack while this Skill is active shortens the time until the stronger pull occurs."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Red Bind Shot",
        "desc": "Fire energy blasts at enemies within a set range.\nApplies Immobile to enemies on hit.\nEnergy blasts will pursue enemies for a set time, and disappear upon hitting a wall.\nThe number of possible targets increases with Skill level."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "God Shine Attack",
        "desc": "Warp to a set position in the sky and release an energy wave, staggering enemies with an explosion.\nCan be discovered by enemy heroes while attacking.\nIf used while buffed by Red Fury, Fury will not deplete."
      }
    ]
  },
  "0037": {
    "id": "0037",
    "difficulty": "40",
    "description": "A powerful hero that mows down enemies with skilled car maneuvers!\nUse \"Let's Drive!\" to ride into battle with allies! Just don't run out of fuel!",
    "statsPath": "M 100.0 70.0 L 146.9 62.6 L 129.2 106.7 L 104.3 109.0 L 56.6 190.1 L 31.8 115.6 L 45.3 56.4 L 100.0 70.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Hovercar",
        "desc": "Propel the car forward while pushing enemies aside.\nInput Vanishing Step to consume fuel and dash for a short duration.\nContinue holding or re-input the command during the dash to keep driving while consuming fuel.\nDriving ends if movement or Vanishing Step input is released, Vanishing Step is re-input while moving, or fuel reaches 0.\nCan redirect while driving.\nFuel gradually recovers over time, recovering faster while not in combat."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "A car-based shooting attack."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Smash Shot",
        "desc": "Fire a shell from the car in a set direction.\n\nExplodes on impact, applying Movement Speed Down to enemies."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Spin Attack",
        "desc": "Spin the car at high speed, knocking back enemies.\nCan move while attacking.\nActivate while driving with Hovercar to attack while moving, and continue holding the movement or Vanishing Step input to keep driving."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Capsule Shelter",
        "desc": "Throw a Hoipoi Capsule at a set location, deploying a shelter.\nCan be reverted back to a capsule by re-inputting the command near the shelter.\n\nShelter:\nConceals self and allies, while protecting from outside enemy hero intrusion and certain attacks.\nVulnerable to DMG from Rush Attacks, and more DMG will be received from energy attacks than strikes.\nWhile deployed, durability gradually decreases over time.\nAt 0 durability, reverts back to a capsule and enters an extended cooldown.\nDurability gradually recovers over time."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Let's Drive!",
        "desc": "Rev the engine, propelling the car forward in a set direction.\nAn ally can interact with the car before acceleration to ride along.\nThe car will take off on re-input or after a set time.\nCan move/redirect before accelerating or while driving.\nWhile driving, No Obstruction is applied to self and the allied hero riding.\nAlly can interact with the car again to dismount.\n\nThe car stops on re-input, after a set time, or upon colliding with an enemy hero, boss, or wall.\nUpon stopping, the car deals DMG to and staggers surrounding enemies. If an ally is riding along, these effects are increased."
      }
    ]
  },
  "0038": {
    "id": "0038",
    "difficulty": "40",
    "description": "A God of Destruction who switches between short- and long-range Skills to overwhelm all. \nUse a Finisher or Super Attack to destroy anyone with a Mark of Destruction!",
    "statsPath": "M 100.0 30.0 L 146.9 62.6 L 148.7 111.1 L 108.7 118.0 L 74.0 154.1 L 61.0 108.9 L 68.7 75.1 L 100.0 30.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "I'll Destroy You",
        "desc": "Increase the ease of landing Finishers on enemy heroes.\nTargets enemy heroes to whom he has applied Mark of Destruction or enemy heroes with Mark of Destruction that he hits with an attack.\nThe total HP threshold to land a Finisher is higher the more Mark of Destruction stacks there are.\nEnemies to whom he has applied Mark of Destruction will take DMG when they are at max stacks."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An energy blast attack.\nExtends the duration of Mark of Destruction on enemies hit.\nThe first attack becomes a powered-up attack if used within a set period of time\nafter activating a Skill (excluding Super Attacks), increasing DMG.\nPowered-up attacks become physical attacks when close to a target."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Sphere of Destruction Shoot",
        "desc": "Kick a Sphere of Destruction at a set position.\nExplodes and applies Mark of Destruction to enemies upon impact.\nThe farther the point of impact, the larger the AoE explosion.\nCan move before impact."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Divine Blitz",
        "desc": "Unleash an aura and dash in a set direction.\nApplies Mark of Destruction to enemies hit.\nDMG dealt increases and dash will end upon hitting an enemy."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Destruction Decree",
        "desc": "An unavoidable Skill marking a target in a set direction.\nApplies Movement Speed Up to self and Mark of Destruction to the enemy.\nWhen another Skill (excluding Super Attacks) hits a marked enemy,\nthe mark explodes, deals DMG, and ends that Skill's cooldown.\nDMG increases the more Mark of Destruction stacks the marked enemy has.\nThe mark wears off as time passes."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Sphere of Destruction Barrage",
        "desc": "Target enemies in range with multiple, unavoidable Spheres of Destruction.\nApplies Marked to targets when activated.\nTargets remain active while within a certain proximity.\nIf affected by I'll Destroy You, targets will be KO'd if their HP falls below the Finisher HP threshold.\nThe number of maximum targets and number of blasts when there is only one target increase with Skill level.\nCan move while attacking."
      }
    ]
  },
  "0036": {
    "id": "0036",
    "difficulty": "20",
    "description": "A clever hero who can unleash high DMG attacks from a distance.\nToy with enemies using quick movements, and pierce through them all at once using Great Ape Strike!",
    "statsPath": "M 100.0 30.0 L 131.3 75.1 L 168.2 115.6 L 113.0 127.0 L 61.0 181.1 L 41.5 113.4 L 60.9 68.8 L 100.0 30.0",
    "skills": [
      {
        "id": "passive1",
        "type": "passive",
        "name": "Kintoun Dash",
        "desc": "Enables a follow up dash after activating a Skill.\nA movement input as the Skill ends triggers a dash in that direction for a set distance."
      },
      {
        "id": "rush_attack1",
        "type": "rush_attack",
        "name": "Rush Attack",
        "desc": "An attack using the Nyoibo.\nMovement Speed is increased during Rush Attacks."
      },
      {
        "id": "skill1",
        "type": "skill",
        "name": "Kamehameha (Youth)",
        "desc": "Fire an energy wave with a rounded edge in a set direction, generating a shockwave.\nThe rounded edge of the wave deals higher DMG upon contact."
      },
      {
        "id": "skill2",
        "type": "skill",
        "name": "Nyoibo Extend",
        "desc": "Extends the Nyoibo in a set direction, piercing through enemies."
      },
      {
        "id": "skill3",
        "type": "skill",
        "name": "Rock-Paper-Scissors",
        "desc": "Dash toward an enemy and strike.\nRe-enter the command to reactivate the skill.\nThrows out rock upon initial activation, scissors upon re-input, and paper with the next re-input, changing in that order.\nRock: Applies All Defense Down to enemies hit.\nScissors: Applies All Defense Down and Shrink Field of View to enemies hit.\nPaper: Changes to an AoE attack, applying All Defense Down to enemies hit.\nStacking All Defense Down extends the effect's duration."
      },
      {
        "id": "super_attack1",
        "type": "super_attack",
        "name": "Great Ape Strike",
        "desc": "Charges forward in a set direction.\nCan be redirected until just before the charge.\nAt Skill Level 2 and Skill Level 3 (Super), deal increased DMG to nearby enemies hit."
      }
    ]
  }
};
