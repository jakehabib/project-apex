/**
 * Name pools for generated people and organisations. All generated names are
 * fictional combinations; organisation words avoid names of real esports teams.
 */
import type { Region } from './types';

export interface Nation {
  readonly name: string;
  readonly region: Region;
  readonly culture: Culture;
  /** Relative share of generated players from this nation within its region. */
  readonly weight: number;
}

export type Culture = 'nordic' | 'germanic' | 'french' | 'iberian' | 'lusophone' | 'slavic' | 'anglo' | 'balkan' | 'turkic' | 'latin' | 'korean' | 'chinese' | 'japanese' | 'sea' | 'mongol' | 'indian' | 'oceanic';

export const NATIONS: readonly Nation[] = [
  { name: 'Denmark', region: 'EU', culture: 'nordic', weight: 6 },
  { name: 'Sweden', region: 'EU', culture: 'nordic', weight: 6 },
  { name: 'Finland', region: 'EU', culture: 'nordic', weight: 4 },
  { name: 'Norway', region: 'EU', culture: 'nordic', weight: 3 },
  { name: 'Germany', region: 'EU', culture: 'germanic', weight: 5 },
  { name: 'Austria', region: 'EU', culture: 'germanic', weight: 1 },
  { name: 'Netherlands', region: 'EU', culture: 'germanic', weight: 2 },
  { name: 'France', region: 'EU', culture: 'french', weight: 6 },
  { name: 'Belgium', region: 'EU', culture: 'french', weight: 2 },
  { name: 'Spain', region: 'EU', culture: 'iberian', weight: 3 },
  { name: 'Portugal', region: 'EU', culture: 'lusophone', weight: 3 },
  { name: 'Italy', region: 'EU', culture: 'iberian', weight: 2 },
  { name: 'Poland', region: 'EU', culture: 'slavic', weight: 7 },
  { name: 'Ukraine', region: 'EU', culture: 'slavic', weight: 6 },
  { name: 'Czech Republic', region: 'EU', culture: 'slavic', weight: 3 },
  { name: 'Slovakia', region: 'EU', culture: 'slavic', weight: 2 },
  { name: 'Latvia', region: 'EU', culture: 'slavic', weight: 2 },
  { name: 'Estonia', region: 'EU', culture: 'nordic', weight: 1 },
  { name: 'Serbia', region: 'EU', culture: 'balkan', weight: 3 },
  { name: 'Bosnia and Herzegovina', region: 'EU', culture: 'balkan', weight: 2 },
  { name: 'Romania', region: 'EU', culture: 'balkan', weight: 2 },
  { name: 'Bulgaria', region: 'EU', culture: 'balkan', weight: 2 },
  { name: 'United Kingdom', region: 'EU', culture: 'anglo', weight: 3 },
  { name: 'Kazakhstan', region: 'EU', culture: 'turkic', weight: 3 },
  { name: 'Turkey', region: 'EU', culture: 'turkic', weight: 4 },
  { name: 'Israel', region: 'EU', culture: 'anglo', weight: 1 },
  { name: 'United States', region: 'AM', culture: 'anglo', weight: 10 },
  { name: 'Canada', region: 'AM', culture: 'anglo', weight: 4 },
  { name: 'Brazil', region: 'AM', culture: 'lusophone', weight: 12 },
  { name: 'Argentina', region: 'AM', culture: 'latin', weight: 5 },
  { name: 'Chile', region: 'AM', culture: 'latin', weight: 2 },
  { name: 'Mexico', region: 'AM', culture: 'latin', weight: 3 },
  { name: 'Uruguay', region: 'AM', culture: 'latin', weight: 1 },
  { name: 'Peru', region: 'AM', culture: 'latin', weight: 1 },
  { name: 'Colombia', region: 'AM', culture: 'latin', weight: 1 },
  { name: 'South Korea', region: 'AS', culture: 'korean', weight: 4 },
  { name: 'China', region: 'AS', culture: 'chinese', weight: 7 },
  { name: 'Japan', region: 'AS', culture: 'japanese', weight: 2 },
  { name: 'Mongolia', region: 'AS', culture: 'mongol', weight: 5 },
  { name: 'Indonesia', region: 'AS', culture: 'sea', weight: 3 },
  { name: 'Philippines', region: 'AS', culture: 'sea', weight: 2 },
  { name: 'Malaysia', region: 'AS', culture: 'sea', weight: 2 },
  { name: 'Vietnam', region: 'AS', culture: 'sea', weight: 2 },
  { name: 'India', region: 'AS', culture: 'indian', weight: 2 },
  { name: 'Australia', region: 'AS', culture: 'oceanic', weight: 5 },
  { name: 'New Zealand', region: 'AS', culture: 'oceanic', weight: 1 },
];

export const NAMES: Record<Culture, { first: readonly string[]; last: readonly string[] }> = {
  nordic: {
    first: ['Mads', 'Emil', 'Rasmus', 'Oskar', 'Linus', 'Viktor', 'Elias', 'Jesper', 'Mikkel', 'Aleksi', 'Eero', 'Joonas', 'Henrik', 'Sindre', 'Anton', 'Nils', 'Tobias', 'Kasper', 'Lauri', 'Ville', 'Magnus', 'Frederik', 'Jonas', 'Sebastian', 'Teemu'],
    last: ['Lindqvist', 'Sørensen', 'Halvorsen', 'Virtanen', 'Laine', 'Nyström', 'Bergman', 'Holm', 'Kristensen', 'Mäkinen', 'Ahlberg', 'Dahl', 'Eriksen', 'Koskinen', 'Lund', 'Sandberg', 'Heikkinen', 'Nygaard', 'Aalto', 'Strand', 'Vesterlund', 'Rantanen', 'Bjørk', 'Engström', 'Moberg'],
  },
  germanic: {
    first: ['Lukas', 'Felix', 'Niklas', 'Jonas', 'Tim', 'Leon', 'Florian', 'Maximilian', 'Jannik', 'Daan', 'Sven', 'Moritz', 'Bastian', 'Lars', 'Thijs', 'Marco', 'Kevin', 'Pascal', 'Julian', 'Dennis'],
    last: ['Brenner', 'Hartmann', 'Vogel', 'Krause', 'Steiner', 'Becker', 'Wolff', 'Schuster', 'Lang', 'Bauer', 'de Vries', 'Visser', 'Kühn', 'Hoffmann', 'Brandt', 'Franke', 'Jansen', 'Winter', 'Seidel', 'Graf'],
  },
  french: {
    first: ['Hugo', 'Théo', 'Lucas', 'Mathis', 'Nathan', 'Kylian', 'Romain', 'Quentin', 'Bastien', 'Clément', 'Yanis', 'Maxime', 'Alexis', 'Florent', 'Jérémy', 'Adrien', 'Gaël', 'Dorian', 'Loïc', 'Corentin'],
    last: ['Morel', 'Laurent', 'Fournier', 'Girard', 'Bonnet', 'Rousseau', 'Mercier', 'Lefèvre', 'Faure', 'Chevalier', 'Gauthier', 'Perrin', 'Marchand', 'Duval', 'Lemaire', 'Dupont', 'Masson', 'Renard', 'Picard', 'Vidal'],
  },
  iberian: {
    first: ['Pablo', 'Álvaro', 'Javier', 'Sergio', 'Adrián', 'Marco', 'Lorenzo', 'Matteo', 'Alessandro', 'Raúl', 'Iker', 'Dario', 'Nicolás', 'Gonzalo', 'Davide', 'Andrea', 'Rubén', 'Óscar', 'Federico', 'Samuele'],
    last: ['Ricci', 'García', 'Moreno', 'Navarro', 'Romero', 'Conti', 'Esposito', 'Marino', 'Ortega', 'Delgado', 'Serrano', 'Ferrari', 'Greco', 'Molina', 'Castillo', 'Bruno', 'Rinaldi', 'Ibáñez', 'Gallo', 'Fuentes'],
  },
  lusophone: {
    first: ['Rafael', 'Gabriel', 'Thiago', 'Bruno', 'Vinícius', 'Lucas', 'Mateus', 'Pedro', 'Felipe', 'Caio', 'Gustavo', 'Henrique', 'Leonardo', 'Diogo', 'Tomás', 'Rodrigo', 'Igor', 'André', 'Murilo', 'Enzo'],
    last: ['Souza', 'Lima', 'Ramos', 'Alves', 'Rocha', 'Ferreira', 'Costa', 'Oliveira', 'Santos', 'Pereira', 'Carvalho', 'Barbosa', 'Ribeiro', 'Martins', 'Araújo', 'Teixeira', 'Moura', 'Cardoso', 'Nunes', 'Freitas'],
  },
  slavic: {
    first: ['Dawid', 'Jakub', 'Kacper', 'Mateusz', 'Artem', 'Oleksandr', 'Denys', 'Maksym', 'Jan', 'Tomáš', 'Ondřej', 'Martin', 'Bohdan', 'Wiktor', 'Filip', 'Mykola', 'Kristaps', 'Roberts', 'Ihor', 'Patryk'],
    last: ['Kowalczyk', 'Nowak', 'Wiśniewski', 'Kovalenko', 'Bondar', 'Melnyk', 'Novák', 'Svoboda', 'Dvořák', 'Shevchuk', 'Zieliński', 'Kaminski', 'Tkachenko', 'Horák', 'Lewandowski', 'Kravets', 'Bērziņš', 'Ozols', 'Marek', 'Sobczak'],
  },
  balkan: {
    first: ['Nikola', 'Luka', 'Stefan', 'Marko', 'Andrei', 'Mihai', 'Aleksandar', 'Dimitar', 'Emir', 'Petar', 'Vlad', 'Tarik', 'Bogdan', 'Ivan', 'Haris', 'Georgi', 'Darko', 'Radu', 'Milan', 'Kenan'],
    last: ['Petrović', 'Jovanović', 'Popescu', 'Ionescu', 'Nikolić', 'Hadžić', 'Dimitrov', 'Ilić', 'Stoica', 'Marković', 'Begić', 'Georgiev', 'Radu', 'Pavlović', 'Kovačević', 'Todorov', 'Mitrović', 'Dumitru', 'Šarić', 'Ivanov'],
  },
  anglo: {
    first: ['Marcus', 'Tyler', 'Jamal', 'Liam', 'Ethan', 'Jack', 'Connor', 'Ryan', 'Owen', 'Jordan', 'Mason', 'Caleb', 'Noah', 'Dylan', 'Sean', 'Aaron', 'Logan', 'Isaac', 'Nathan', 'Kyle'],
    last: ['Reed', 'Brooks', 'Carter', "O'Connor", 'Hayes', 'Bennett', 'Foster', 'Collins', 'Murphy', 'Parker', 'Walsh', 'Turner', 'Ellis', 'Grant', 'Hughes', 'Price', 'Fletcher', 'Shaw', 'Barnes', 'Morgan'],
  },
  turkic: {
    first: ['Daniyar', 'Arman', 'Yerlan', 'Emre', 'Burak', 'Can', 'Mert', 'Kerem', 'Aidos', 'Timur', 'Yusuf', 'Berk', 'Nurlan', 'Ozan', 'Alikhan', 'Kaan', 'Serik', 'Deniz', 'Erzhan', 'Baran'],
    last: ['Seitkali', 'Abenov', 'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Nurlanov', 'Aydın', 'Kenzhebek', 'Öztürk', 'Bekov', 'Arslan', 'Zhaksylyk', 'Doğan', 'Tulegenov', 'Çelik', 'Omarov', 'Koç', 'Saparov', 'Erdem'],
  },
  latin: {
    first: ['Diego', 'Santiago', 'Matías', 'Joaquín', 'Facundo', 'Tomás', 'Benjamín', 'Agustín', 'Emiliano', 'Iván', 'Lautaro', 'Ignacio', 'Sebastián', 'Franco', 'Alejandro', 'Martín', 'Gael', 'Bruno', 'Esteban', 'Mauricio'],
    last: ['Álvarez', 'González', 'Fernández', 'Rodríguez', 'Sánchez', 'Díaz', 'Torres', 'Ruiz', 'Vargas', 'Herrera', 'Medina', 'Aguirre', 'Ríos', 'Castro', 'Rojas', 'Paredes', 'Cabrera', 'Ponce', 'Guzmán', 'Salazar'],
  },
  korean: {
    first: ['Joon-ho', 'Min-seok', 'Dae-hyun', 'Ji-hoon', 'Seung-woo', 'Hyun-jin', 'Tae-yang', 'Jae-won', 'Sung-min', 'Woo-jin', 'Dong-hyun', 'Ye-jun', 'Do-yun', 'Si-woo', 'Ha-joon'],
    last: ['Park', 'Choi', 'Kang', 'Kim', 'Lee', 'Jung', 'Yoon', 'Han', 'Shin', 'Oh', 'Seo', 'Kwon', 'Hwang', 'Song', 'Jang'],
  },
  chinese: {
    first: ['Wei', 'Hao', 'Jun', 'Yifan', 'Zihan', 'Haoran', 'Tian', 'Jiahao', 'Ming', 'Rui', 'Xuan', 'Bowen', 'Kai', 'Yuchen', 'Zhen'],
    last: ['Chen', 'Wang', 'Li', 'Zhang', 'Liu', 'Yang', 'Zhao', 'Huang', 'Zhou', 'Wu', 'Xu', 'Sun', 'Ma', 'Hu', 'Guo'],
  },
  japanese: {
    first: ['Haruto', 'Yuto', 'Sota', 'Ren', 'Kaito', 'Riku', 'Daiki', 'Kenta', 'Takumi', 'Shun', 'Yuki', 'Kazuki', 'Hayato', 'Sho', 'Ryota'],
    last: ['Saito', 'Mori', 'Tanaka', 'Suzuki', 'Takahashi', 'Ito', 'Watanabe', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Inoue', 'Kimura', 'Hayashi'],
  },
  mongol: {
    first: ['Bat-Erdene', 'Temuulen', 'Ganbold', 'Enkhjin', 'Tsogt', 'Bilguun', 'Munkh-Orgil', 'Altankhuyag', 'Sukhbat', 'Erdenebat', 'Nomin-Erdene', 'Tuvshin', 'Batbayar', 'Khuslen', 'Ochir'],
    last: ['Batsaikhan', 'Ganbaatar', 'Erdenechimeg', 'Dorj', 'Tserendorj', 'Bayarsaikhan', 'Altangerel', 'Purevdorj', 'Enkhbayar', 'Sukhbaatar', 'Lkhagva', 'Davaasuren', 'Tumur', 'Byambaa', 'Otgon'],
  },
  sea: {
    first: ['Rizky', 'Aditya', 'Bagas', 'Joshua', 'Mark', 'Carlo', 'Hafiz', 'Amir', 'Minh', 'Khoa', 'Daniel', 'Farhan', 'Paolo', 'Danial', 'Tuan'],
    last: ['Pratama', 'Santoso', 'Wijaya', 'Reyes', 'Santos', 'Cruz', 'Rahman', 'Ismail', 'Nguyen', 'Tran', 'Hidayat', 'Bautista', 'Hakim', 'Pham', 'Lim'],
  },
  indian: {
    first: ['Arjun', 'Rohan', 'Aarav', 'Kabir', 'Vikram', 'Ishaan', 'Dev', 'Aditya', 'Karan', 'Nikhil', 'Siddharth', 'Rahul', 'Varun', 'Aryan', 'Neil'],
    last: ['Mehta', 'Sharma', 'Patel', 'Iyer', 'Rao', 'Nair', 'Kapoor', 'Gupta', 'Reddy', 'Singh', 'Bose', 'Joshi', 'Malhotra', 'Desai', 'Menon'],
  },
  oceanic: {
    first: ['Jack', 'Sam', 'Hemi', 'Riley', 'Lachlan', 'Cooper', 'Tane', 'Harrison', 'Mitchell', 'Blake', 'Jayden', 'Ari', 'Corey', 'Josh', 'Nate'],
    last: ['Thompson', 'Walker', 'Fischer', 'Mitchell', 'Wilson', 'Taylor', 'Ngata', 'Campbell', 'Kelly', 'Robinson', 'Henare', 'Stewart', 'Clarke', 'Wright', 'Edwards'],
  },
};

/** Nickname building blocks (lowercase, short, gamer-style). */
export const NICK_PARTS: readonly string[] = [
  'vex', 'nyx', 'kilo', 'ash', 'drift', 'onyx', 'sly', 'rune', 'echo', 'jinx', 'flux', 'hex', 'lynx', 'rift', 'sable', 'tusk', 'volt', 'wisp', 'zephyr',
  'koda', 'brisk', 'cinder', 'dusk', 'fable', 'grit', 'halo', 'iris', 'jolt', 'karma', 'lumen', 'mirth', 'nova', 'opal', 'pyre', 'quill', 'rook', 'shade', 'tempo', 'umbra',
  'vandal', 'warden', 'xeno', 'yaw', 'zen', 'arc', 'bolt', 'coda', 'dune', 'ember', 'frost', 'glint', 'haze', 'ion', 'jade', 'loom', 'myth', 'nomad', 'orbit',
  'prism', 'quake', 'raven', 'surge', 'thorn', 'ultra', 'vigil', 'whirl', 'axel', 'blitz', 'crux', 'dart', 'eon', 'fang', 'gale', 'hush', 'ink', 'juno', 'knack', 'lull',
  'mute', 'nimbus', 'omen', 'pax', 'quin', 'rally', 'sonic', 'tide', 'uno', 'vapor', 'wick', 'yeti', 'zinc', 'byte', 'clove', 'delta', 'fizz', 'gusto', 'helix',
];

/** Organisation name parts. Checked against names of real professional teams. */
export const ORG_FIRST: readonly string[] = [
  'Northwind', 'Red Kite', 'Iron Vale', 'Sunline', 'Polar Arc', 'Obsidian Tide', 'Hollow Crown', 'Atlas Union', 'Granite', 'Silver Fern', 'Crimson Peak', 'Night Owl',
  'Blue Harbor', 'Wild Ember', 'Stormfront', 'High Tide', 'Black Lantern', 'Copper Fox', 'Ivory Gate', 'Jade Serpent', 'Lone Pine', 'Moonrise', 'Old Forge', 'Quiet Storm',
  'Rising Signal', 'Salt Marsh', 'Tin Soldier', 'Velvet Hammer', 'White Rook', 'Amber Coast', 'Basalt', 'Cobalt Shore', 'Driftwood', 'Emerald Isle', 'Frostbite', 'Golden Hour',
  'Harbor Lights', 'Iron Lotus', 'Kingfisher', 'Lighthouse', 'Midnight Sun', 'North Star', 'Orchid', 'Paper Tiger', 'Quicksilver', 'Redwood', 'Sandstorm', 'Thunderbird',
  'Undertow', 'Vanguard Six', 'Westwind', 'Yellowjacket', 'Zenith', 'Arctic Fox', 'Blackthorn', 'Cedar Ridge', 'Dawnbreak', 'Echo Valley', 'Firefly', 'Glacier',
  'Hailstone', 'Ironclad', 'Juniper', 'Kodiak', 'Lowland', 'Monolith', 'Nightjar', 'Overcast', 'Pinewood', 'Quarry', 'Riverbend', 'Skyline', 'Tidewater', 'Umber',
  'Vireo', 'Wolfpine', 'Yarrow', 'Zephyr Line', 'Albatross', 'Bramble', 'Canyon', 'Deep Current', 'Evergreen', 'Falconet', 'Greyhound', 'Heron', 'Indigo', 'Jackal',
  'Kraken Bay', 'Lionheart', 'Mariner', 'Nettle', 'Osprey', 'Peregrine', 'Quokka', 'Ridgeback', 'Starling', 'Timberline', 'Uplift', 'Verdant', 'Waypoint', 'Wren',
  'Anvil Works', 'Beacon Hill', 'Coldharbour', 'Dragonfly', 'Eastgate', 'Foxglove', 'Gravel Pit', 'Hightower', 'Ironbark', 'Jetstream', 'Keystone', 'Longbow', 'Meridian',
  'Nautilus', 'Outpost', 'Paragon', 'Quasar', 'Rampart', 'Sentinel Peak', 'Tamarack', 'Valkyr', 'Watchtower', 'Xylo', 'Yukon', 'Zircon', 'Avalanche',
  'Bluefin', 'Catalyst', 'Daybreak', 'Equinox', 'Fathom', 'Gemini Port', 'Horizon Line', 'Inkwell', 'Jubilee', 'Kitehawk', 'Lodestar', 'Magpie', 'Nebula Nine',
];
export const ORG_SUFFIX: readonly string[] = ['', '', '', ' Esports', ' Gaming', ' Club', ' Collective', ' Team'];
