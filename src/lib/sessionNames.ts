import { uniqueNamesGenerator } from 'unique-names-generator';

const adjectives = [
  'Bluffing', 'All-In', 'Rivered', 'Tilted', 'Stacked', 'Wild', 'Lucky',
  'Ragged', 'Suited', 'Shark', 'Donkey', 'Nit', 'Loose', 'Passive',
  'Aggressive', 'Broke', 'Flush', 'Pocket', 'Golden', 'Slick',
  'Dirty', 'Crazy', 'Sneaky', 'Bold', 'Fearless', 'Reckless', 'Smooth',
  'Clumsy', 'Sleepy', 'Hungry', 'Grumpy', 'Fancy', 'Mighty', 'Tiny',
  'Giant', 'Silent', 'Loud', 'Swift', 'Fuzzy', 'Spicy', 'Chill',
  'Toxic', 'Salty', 'Sweet', 'Bitter', 'Crooked', 'Wobbly', 'Dizzy',
  'Puzzled', 'Bored', 'Jazzy', 'Punky', 'Funky', 'Geeky', 'Nerdy',
];

const nouns = [
  'Aardvark', 'Badger', 'Catfish', 'Donkey', 'Flamingo', 'Giraffe',
  'Hedgehog', 'Iguana', 'Jackal', 'Koala', 'Lemur', 'Manatee',
  'Narwhal', 'Ocelot', 'Platypus', 'Quokka', 'Raccoon', 'Sloth',
  'Tapir', 'Urchin', 'Viper', 'Walrus', 'Xenops', 'Yak', 'Zebra',
  'Axolotl', 'Baboon', 'Chinchilla', 'Dingo', 'Emu', 'Ferret',
  'Gopher', 'Hamster', 'Ibex', 'Jaguar', 'Llama', 'Mongoose',
  'Nutria', 'Otter', 'Porcupine', 'Quail', 'Rooster', 'Squirrel',
  'Turtle', 'Unicorn', 'Vulture', 'Whale', 'Yeth', 'Goblin',
  'Kraken', 'Phoenix', 'Dragon', 'Wizard', 'Bandit', 'Ninja',
  'Pirate', 'Samurai', 'Viking', 'Cowboy', 'Zombie', 'Robot',
  'Alien', 'Ghost', 'Monster', 'Troll', 'Ogre', 'Gremlin',
];

export function randomSessionName(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, nouns],
    separator: ' ',
    length: 2,
    style: 'capital',
  });
}
