const argv = require('minimist')(process.argv.slice(2));
const find = require('find');
const LineByLineReader = require('line-by-line');
const fs = require('fs');
const empty = require('empty-folder');
const moment = require('moment');
const faker = require('faker');
faker.locale = "de";



/* ---- */



let srcPath;
if (!argv['src']) {
    console.error('No source path set. Example: "--src=/path/to/soruce/files"');
    process.exit(1);
} else {
    srcPath = argv['src'];
}

if (!fs.existsSync(srcPath)){
    console.error('Source path does not exist.');
    process.exit(1);
}

let dstPath;
if (argv['dst']) {
    dstPath = argv['dst'];
} else {
    dstPath = __dirname + '/tmp'
}

if (!fs.existsSync(dstPath)){
    fs.mkdirSync(dstPath);
}



/* ---- */



const interfaces = new Map();

const propertyLineRe = /^\s*(\w+)[\s?:]*(\w+)([\[\]]*);$/im;
const classLineRe = /^export\s+interface\s+(\w*).*$/i;



/* ---- */



const parseImports = (i) => {
    const interfaceImports = `import { ${i.name} } from '${i.path}';`;
    const mockImports = i.properties
        .filter(isNoPrimitiveDataType)
        .map(x => `import { mock${x.type}1 } from './${x.type}.stubs.ts';`)
        .join('\n');

    return `${interfaceImports}\n${mockImports}`;
};

const isNoPrimitiveDataType = (x) => {
    return x.type !== 'number' && x.type !== 'boolean' && x.type !== 'string' && x.type !== 'any';
}

const parseProperties = (properties) => {
    return properties
        .map(x => `${x.name}: ${generateValue(x)}`)
        .join(',\n\t');
};

const generateValue = (property) => {
    let value = null;
    let type = property.type;

    switch (property.name) {
        case 'dateOfBirth':
        case 'expiration':
        case 'createdAt':
        case 'end':
        case 'start':
            type = 'Date';
            break;

        case 'street':
            type = 'street';
            break;

        case 'postalCode':
        case 'zip':
            type = 'zip';
            break;

        case 'email':
        case 'email1':
        case 'email2':
            type = 'email';
            break;

        case 'country':
            type = 'country';
            break;

        case 'city':
        case 'town':
            type = 'city';
            break;

        case 'firstName':
        case 'lastName':
        case 'name':
            type = 'name';
            break;
    }

    switch (type) {
        case 'number':
            value = faker.random.number();
        break;
        case 'string':
            value = `'${faker.random.word()}'`;
        break;
        case 'zip':
            value = `'${faker.random.number({min:10000, max:99999})}'`;
        break;
        case 'street':
            value = `'${faker.address.streetName()} ${faker.random.number({min:1, max:200})}'`;
        break;
        case 'email':
            value = `'${faker.internet.email()}'`;
        break;
        case 'country':
            value = `'${faker.address.country()}'`;
        break;
        case 'city':
            value = `'${faker.address.city()}'`;
        break;
        case 'name':
            value = `'${faker.name.firstName()}'`;
        break;
        case 'boolean':
            value = faker.random.boolean();
        break;
        case 'Date':
            value = `'${moment(faker.date.recent()).format('YYYY-MM-DD')}'`;
        break;
        case 'null':
            value = 'null';
        break;
        default:
            value = `mock${property.type}1`;
    }

    return `${property.isArray ? '[ ' : ''}${isNoPrimitiveDataType(property) ? '{... ' : ''}${value}${isNoPrimitiveDataType(property) ? ' }' : ''}${property.isArray ? ' ]' : ''}`;
};

const createMockData = async () => {
    const interfacesArr = Array.from(interfaces);

    await Promise.all(
        interfacesArr.map(async ([k, i]) => {
            const filepath = dstPath + '/' + i.name + '.stubs.ts';
            const fileContent = `${parseImports(i)}

export const mock${i.name}1: ${i.name} {\n\t${parseProperties(i.properties)}\n};`;

            await fs.writeFile(filepath, fileContent, (err) => {
                if (err) {
                    console.log('Error writing ' + i.name + '!', err);
                } else {

                }
            });
        })
    );
};

const initialize = () => new Promise((done, err) => done());

const emptyDst = () => new Promise((done, err) => {
    empty(dstPath, false, (o) => {
        if(o.error) console.error(err);
        console.log(o.removed.length + ' files removed from dstPath.');
        done();

        //console.log(o.failed);
    });
});

const composeInterfaceData = () => new Promise((done, err) => {
    let fileCount = 0;
    find.eachfile(/\.interface\.ts$/, srcPath, (file) => {
        var interfaceName = '';
        var interfaceProperties = [];
        var interfacePath = file;

        var lr = new LineByLineReader(file);
        lr.on('line', (line) => {
            const propertyMatch = line.match(propertyLineRe);
            const classMatch = line.match(classLineRe);

            if (propertyMatch) {
                var property = {
                    name: propertyMatch[1],
                    type: propertyMatch[2],
                    isArray: !!propertyMatch[3]
                };

                interfaceProperties.push(property);
            } else if (classMatch) {
                interfaceName = classMatch[1];
            }
        });

        lr.on('end', () => {
            if (interfaceName != '') {
                interfaces.set(interfaceName, {
                    name: interfaceName,
                    path: interfacePath,
                    properties: interfaceProperties
                });

                fileCount++;
            }
        });
    }).end(() => {
        console.log('Found ' + fileCount + ' interfaces.');
        done();
    });
});



/* ---- */


initialize()
    .then(emptyDst)
    .then(composeInterfaceData)
    .then(createMockData)
    .then(() => console.log('done'));
