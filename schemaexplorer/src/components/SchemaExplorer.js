import { useEffect, useState } from 'react';
// import './SchemaExplorer.css';
import prettier from 'prettier';
import parserGraphQL from 'prettier/parser-graphql';
class CheckboxObjBuilder {
  constructor(initialState = {}) {
    this.checkboxObj = initialState;
  }
  checkboxObj = {};
  currentRelation = null;

  setCurrentRelation(relation) {
    this.currentRelation = relation;
  }
  toggleProperty(relation, property, nestedRelations = []) {
    let currentObj = this.checkboxObj;

    for (const relationName of nestedRelations) {
      if (!currentObj[relationName] || typeof currentObj[relationName] !== 'object') {
        currentObj[relationName] = {};
      }
      currentObj = currentObj[relationName];
    }

    if (currentObj[property]) {
      delete currentObj[property];
    } else {
      currentObj[property] = true;
    }
  }

  isSelected(relation, property) {
    if (this.checkboxObj[relation]?.[property] === true) {
      return true;
    }
  }

  getCheckboxObj() {
    return this.checkboxObj;
  }
}

function SchemaExplorer() {
  const baseUrl = '../public/data';

  const [generatedGraphQLQuery2, setGeneratedGraphQLQuery2] = useState('');

  const [entityDefinitions, setEntityDefinitions] = useState(null);
  const [chosenRelationData, setChosenRelationData] = useState(null);
  const [chosenRelationName, setChosenRelationName] = useState(null);
  const [chosenRelationNameFromUrl, setChosenRelationNameFromUrl] = useState(null);

  const [chosenSchema, setChosenSchema] = useState('');
  const [schema, setSchema] = useState(null);
  const [generatedQuery, setGeneratedQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState({});

  const [tabNumber, setTabNumber] = useState(0);

  const [checkboxObjBuilder, setCheckboxObjBuilder] = useState(new CheckboxObjBuilder());

  const [relationPath, setRelationPath] = useState([]);

  const [isBacked, setIsBacked] = useState(false);

  const [chosenRelationNamesArr, setChosenRelationNamesArr] = useState([]);

  const [allAddedParents, setAllAddedParents] = useState([]);

  const [searchInput, setSearchInput] = useState('');
  const [filteredMembers, setFilteredMembers] = useState([]);

  useEffect(() => {
    async function fetchEntityDefinitions() {
      try {
        const response = await fetch(`${baseUrl}/entitydefinitions.json`);
        const data = await response.json();
        setEntityDefinitions(data);
        setSchema(data?.items.map((item) => item.name));
      } catch (error) {
        console.error(error);
      }
    }

    async function fetchChosenRelationData() {
      try {
        if (chosenRelationNameFromUrl) {
          const response = await fetch(`${baseUrl}/${chosenRelationNameFromUrl}.json`);
          const data = await response.json();
          setChosenRelationData(data);
        }
      } catch (error) {
        console.error(error);
      }
    }

    fetchChosenRelationData();
    fetchEntityDefinitions();
  }, [chosenRelationNameFromUrl]);

  useEffect(() => {
    // generateGraphQLQuery();
    generateGraphQLQuery2();
  }, [chosenSchema, checkboxObjBuilder, tabNumber]);

  const handleSearchInputChange = (event) => {
    const inputValue = event.target.value;
    setSearchInput(inputValue);

    // Filter the properties based on the input value
    const filtered = schemaDefinition?.member_groups.flatMap((memberGroup) =>
      memberGroup.members.filter((member) =>
        member.name.toLowerCase().includes(inputValue.toLowerCase()),
      ),
    );
    setFilteredMembers(filtered);
  };

  const handleSchemaChange = (event) => {
    const selectedSchema = event.target.value;
    setChosenSchema(selectedSchema);
  };

  const handleMemberSelection = (member) => {
    const newCheckboxObjBuilder = new CheckboxObjBuilder(checkboxObjBuilder.getCheckboxObj());
    const relation = tabNumber === 0 ? chosenSchema : chosenRelationName;
    newCheckboxObjBuilder.toggleProperty(relation, member, relationPath);
    setCheckboxObjBuilder(newCheckboxObjBuilder);
  };

  function generateGraphQLQuery2() {
    let isCardinalityManyToMany = false;

    const checkIsCardinalityManyToMany = () => {
      chosenRelationData?.member_groups.map((memberGroup) => {
        memberGroup.members.map((member) => {
          if (member.name === chosenRelationName && member.cardinality === 'ManyToMany') {
            isCardinalityManyToMany = true;
          }
          if (member.name === chosenRelationName && member.cardinality === 'OneToMany') {
            isCardinalityManyToMany = true;
          }
        });
      });
    };

    const checkboxObj = checkboxObjBuilder.getCheckboxObj();

    const generateQuery = () => {
      const formatQuery = (query) => {
        query.replace(/\./g, '_');
        try {
          const formattedQuery = prettier.format(query, {
            parser: 'graphql',
            plugins: [parserGraphQL],
          });
          return formattedQuery;
        } catch (error) {
          console.error('Failed to format query:', error);
          return query;
        }
      };

      const fields = Object.keys(checkboxObj).map((key) => {
        console.clear();
        console.log('Object.keys(checkboxObj)', Object.keys(checkboxObj));

        checkIsCardinalityManyToMany();

        if (typeof checkboxObj[key] === 'boolean') {
          Object.keys(checkboxObj).map((key) => {
            if (typeof checkboxObj[key] === 'boolean') {
              setAllAddedParents([...allAddedParents, key]);
            }
          });

          return key;
        } else {
          setAllAddedParents([...allAddedParents, key]);
          // console.clear()
          // console.log('allAddedParents', allAddedParents)

          const subFields = Object.keys(checkboxObj[key]);
          const subFieldQueries = subFields.map((subField) => `${subField}`);
          const subFieldQuery = subFieldQueries.join('\n');

          console.log('key', key);
          if (isCardinalityManyToMany === true) {
            return `${key} {
                results {
                  ${subFieldQuery}
                }
              }`;
          } else {
            isCardinalityManyToMany = false;
            return subFieldQuery
              ? `${key} {
              ${subFieldQuery}
            }`
              : `${key}`;
          }
        }
      });
      const query = `
        query allRIC_Article {
          results {
            ${fields.join('\n').replace(/\./g, '_')}
          }
        }`;

      console.log('query', query);

      const prettierQuery = formatQuery(query);

      setGeneratedGraphQLQuery2(prettierQuery);
    };

    generateQuery();
  }

  function prettifyQuery() {
    const formatQuery = (query) => {
      try {
        const formattedQuery = prettier.format(query, {
          parser: 'graphql', // Use the 'babel' parser for JavaScript code
          plugins: [parserGraphQL], // Add any required prettier plugins
        });
        return formattedQuery;
      } catch (error) {
        console.error('Failed to format query:', error);
        return query;
      }
    };
    const prettierQuery = formatQuery(generatedQuery);
    setGeneratedQuery(prettierQuery);
    console.log('Generated query', formatQuery(generatedQuery));
  }

  const handleCheckboxChange = (event) => {
    const { name } = event.target;
    const newCheckboxObjBuilder = new CheckboxObjBuilder(checkboxObjBuilder.getCheckboxObj());
    const relation = tabNumber === 0 ? chosenSchema : chosenRelationName;
    newCheckboxObjBuilder.toggleProperty(relation, name, relationPath);
    setCheckboxObjBuilder(newCheckboxObjBuilder);
  };

  const schemaDefinition = entityDefinitions?.items.find((item) => item.name === chosenSchema);

  return (
    <>
      {/* <Button
      onClick={() => {
        console.log('chosenRelationName', chosenRelationName);
      }}
    >
      chosenRelationName
    </Button> */}

      <header className="SchemaExplorer-header">
        {chosenSchema ? <h1>Schema: {chosenSchema}</h1> : <h1>Choose Schema:</h1>}
        <div className="buttons-section">
          <select onChange={handleSchemaChange}>
            <option>Select a schema</option>
            {entityDefinitions?.items
              ?.sort((a, b) => a.name.localeCompare(b.name)) // Sort the array alphabetically by 'name'
              .map((item) => (
                <option key={`option-${item.name}`} value={item.name}>
                  {item?.name}
                </option>
              ))}
          </select>
          <button
            onClick={() => {
              generateGraphQLQuery2();
              prettifyQuery();
            }}
          >
            Generate Query
          </button>
          <button onClick={() => prettifyQuery()}>Prettier</button>
          <button>Validate mSchemaExplorering</button>
          <button>Validate query</button>
        </div>
      </header>
      {/* <h4>Tab {tabNumber}</h4>
        <h4>{tabNumber === 0 ? 'Properties' : 'Relations'}</h4> */}

      <div
        className="container"
        key="container">
        <div
          className="container-content"
          style={{
            overflow: chosenSchema ? 'auto' : 'hidden',
          }}
        >
          {!chosenSchema && (
            <h4>
              {' '}
              Choose Schema First
            </h4>
          )}
          {/* PROPERTIES SECTION */}
          <div
            className='properties-section'
            style={{
              opacity: tabNumber === 0 ? 1 : 0.4,
              pointerEvents: tabNumber === 0 ? 'all' : 'none',
            }}
          >
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchInputChange}
              placeholder="Search properties..."
              disabled={!chosenSchema}
            />

            {searchInput === '' ? (
              <div className='properties-section-content'>
                {schemaDefinition?.member_groups.map((memberGroup, groupIndex) => (
                  <div key={`group-${groupIndex}`}>
                    {memberGroup.members.map(
                      (member, memberIndex) =>
                        member.type !== 'Relation' && (
                          <ul key={`member-${member.name}-${memberIndex}`}>
                            <li className="triple-col" key={`member-${member.name}-${memberIndex}`}>
                              <span className='checkbox-label'>
                                <input
                                  key={`input-${member.name}-${memberIndex}`}
                                  type="checkbox"
                                  name={member.name}
                                  checked={checkboxObjBuilder.isSelected(chosenSchema, member.name)}
                                  onChange={handleCheckboxChange}
                                />
                                {member.name}
                              </span>
                              <span>{memberGroup.name}</span>
                              <span
                                onClick={() => {
                                  if (member.type === 'Relation') {
                                    setTabNumber(1);
                                    setChosenRelationName(member.name);
                                    setChosenRelationNameFromUrl(
                                      member.associated_entitydefinition.href.split('/').pop(),
                                    );
                                    setRelationPath([...relationPath, member.name]);
                                    checkboxObjBuilder.setCurrentRelation(member.name);
                                  }
                                }}
                                style={
                                  member.type === 'Relation'
                                    ? { cursor: 'pointer', fontWeight: 'bold' }
                                    : {}
                                }
                              >
                                {member.type}
                              </span>
                            </li>
                          </ul>
                        ),
                    )}
                  </div>
                ))}
                {schemaDefinition?.member_groups.map((memberGroup, groupIndex) => (
                  <div key={`group-${groupIndex}`}>
                    {memberGroup.members.map(
                      (member, memberIndex) =>
                        member.type === 'Relation' && (
                          <ul key={`member-${member.name}-${memberIndex}`}>
                            <li className="triple-col" key={`member-${member.name}-${memberIndex}`}>
                              <span style={{ display: 'flex', gap: 5 }} className='checkbox-label'>
                                <input
                                  key={`input-${member.name}-${memberIndex}`}
                                  type="checkbox"
                                  name={member.name}
                                  checked={checkboxObjBuilder.isSelected(chosenSchema, member.name)}
                                  onChange={handleCheckboxChange}
                                />
                                {member.name}
                              </span>
                              <span>{memberGroup.name}</span>
                              <span
                                onClick={() => {
                                  if (member.type === 'Relation') {
                                    setTabNumber(1);
                                    setChosenRelationName(member.name);
                                    setChosenRelationNameFromUrl(
                                      member.associated_entitydefinition.href.split('/').pop(),
                                    );
                                    setRelationPath([...relationPath, member.name]);
                                    checkboxObjBuilder.setCurrentRelation(member.name);
                                  }
                                }}
                                style={
                                  member.type === 'Relation'
                                    ? { cursor: 'pointer', fontWeight: 'bold' }
                                    : {}
                                }
                              >
                                {member.type}
                                {member.cardinality && `: ${member.cardinality}`}
                              </span>
                            </li>
                          </ul>
                        ),
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {filteredMembers.map((member, index) => (
                  <ul key={`filtered-member-${index}`}>
                    <li className="triple-col">
                      <span className='checkbox-label'>
                        <input
                          key={`input-${member.name}-${index}`}
                          type="checkbox"
                          name={member.name}
                          checked={checkboxObjBuilder.isSelected(chosenSchema, member.name)}
                          onChange={handleCheckboxChange}
                        />
                        {member.name}
                      </span>
                      <span>{member.memberGroup}</span>
                      <span
                        onClick={() => {
                          if (member.type === 'Relation') {
                            setTabNumber(1);
                            setChosenRelationName(member.name);
                            setChosenRelationNameFromUrl(
                              member.associated_entitydefinition.href.split('/').pop(),
                            );
                            setRelationPath([...relationPath, member.name]);
                            checkboxObjBuilder.setCurrentRelation(member.name);
                          }
                        }}
                        style={
                          member.type === 'Relation'
                            ? { cursor: 'pointer', fontWeight: 'bold' }
                            : {}
                        }
                      >
                        {member.type}
                      </span>
                      {/* cardinality type: {member.cardinality} */}
                    </li>
                  </ul>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RELATIONS SECTION */}
        {chosenSchema && (
          <button
            onClick={() => {
              setTabNumber(0);
              setRelationPath(relationPath.slice(0, -1));
              setIsBacked(true);
            }}
            disabled={tabNumber === 0}
          >
            Back
          </button>
        )}
        <div className='relations-section'>
          {!chosenRelationData && (
            <span className='relations-section-info'
              style={{  display: chosenSchema ? 'block' : 'none', opacity: 0.4 }}
            >
              Click on property relation
            </span>
          )}
          {chosenRelationData && tabNumber === 1 && (
            <ul
              className='relations-section-tab-1'
            >
              {chosenRelationData.member_groups.map((memberGroup, groupIndex) => (
                <div key={`group-${groupIndex}`}>
                  {memberGroup.members.map((member, memberIndex) => (
                    <ul key={`member-${member.name}-${memberIndex}`}>
                      {member.type !== 'Relation' && (
                        <li key={`member-${member.name}-${memberIndex}`}>
                          <span>
                            <input
                              key={`input-${member.name}-${memberIndex}`}
                              type="checkbox"
                              checked={checkboxObjBuilder.isSelected(
                                chosenRelationName,
                                member.name,
                              )}
                              onChange={() => handleMemberSelection(member.name)}
                            />
                            {member.name}
                          </span>
                          <span>{memberGroup.name}</span>
                          <span
                            onClick={() => {
                              if (member.type === 'Relation') {
                                setTabNumber(1);
                                setChosenRelationName(member.name);
                                setChosenRelationNameFromUrl(
                                  member.associated_entitydefinition.href.split('/').pop(),
                                );
                                setRelationPath([...relationPath, member.name]);
                                checkboxObjBuilder.setCurrentRelation(member.name);
                              }
                            }}
                          >
                            {member.type}
                          </span>
                        </li>
                      )}
                    </ul>
                  ))}
                </div>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        className='query-section'
        style={{
          position: 'relative',
        }}
      >
        <textarea
          className="form-control"
          value={generatedGraphQLQuery2}
          onChange={() => generateGraphQLQuery2()}
          spellCheck="false"
        ></textarea>
        <button
          className='copy-button'
          onClick={() => {
            navigator.clipboard.writeText(generatedGraphQLQuery2);
          }}
        >
          Copy Query
        </button>
      </div>
    </>
  );
}

export default SchemaExplorer;
