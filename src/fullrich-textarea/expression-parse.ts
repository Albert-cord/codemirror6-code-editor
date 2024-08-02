const DEFINES = ['沪深300', '中证500', '上证50', '银行活期利率'];
function getDefineValue(value: (typeof DEFINES)[number]) {
    if(value === '沪深300') {
        return 'index[300]';
    } else if(value === '中证500') {
        return 'index[500]';
    } else if(value === '上证50') {
        return 'index[50]';
    } else if(value === '银行活期利率') {
        return 'index[50]';
    }
    return 'unknown';
}
const MAX_REGEXP_DEFINE = ['Max('];
const MIN_REGEXP_DEFINE = ['Min('];
const ANNUALIZED_REGEXP_DEFINE = ['年化利率'];

interface DefineModel {
    /** 名称 */
    name: '沪深300' | '中证500' | '上证50' | '银行活期利率' | 'Max(,)' | 'Min(,)' | '年化利率%' | 'numberal' | 'bracket';
    /** 起始 */
    from: number;
    /** 截止 */
    to: number;
    /** 值 value为null时说明 未结束 */
    value: string | null;
    /** 是否结束 */
    done: boolean;
  }
  
  

class ExpressionValidator {
    states = {
        START: 'START',
        NUMBER: 'NUMBER',
        DECIMAL: 'DECIMAL',
        OPERATOR: 'OPERATOR',
        LEFT_PAREN: 'LEFT_PAREN',
        RIGHT_PAREN: 'RIGHT_PAREN',
        SIGN: 'SIGN',
        MAX_DEFINE: 'MAX',
        MIN_DEFINE: 'MIN',
        ANNUALIZED_DEFINE: 'ANNUALIZED',
        ANNUALIZED_DEFINE_END: 'ANNUALIZED_END',
        MAX_MIN_DEFINE_SPLIT: ',',
        INDEX_DEFINE: 'INDEX_DEFINE',
    };
    expression: string = '';
    stack: string[] = [];
    currentState = this.states.START;
    contexts: DefineModel[] = [];
    currentContext: DefineModel|null = null;
    parenCount = 0;
    position = 0;
    
    constructor() {
      this.currentState = this.states.START;
      this.parenCount = 0; // To track unmatched parentheses
      this.position = 0;
    }
    
    getUnDoneContext(name?: DefineModel['name']) {
        return this.contexts.slice().reverse().find(item => {
            return !item.done && (!name || name === item.name)
        })
    }

    updateContextToDone(context: DefineModel, to: number) {
        context.done = true;
        context.to = to;
        context.value = this.expression.slice(context.from, context.to + 1);
    }

    getNumberDesc(start: number) {
        let pos = start;
        let isNumber = false;
        let isDecimal = false;
        while(pos < this.expression.length) {
            if(this.isDigit(this.expression[pos])) {
                if(!isDecimal) {
                    isNumber = true;
                }
                pos++
            } else if(this.expression[pos] === '.') {
                if(!this.isDigit(this.expression[pos + 1])) {
                    isNumber = false;
                    isDecimal = false;
                    break;
                }
                isNumber = false;
                isDecimal = true;
                pos++
            } else if(this.expression[pos] === '%') {
                pos++
                break;
            } else {
                break;
            }
        }
        return {
            isNumber,
            isDecimal,
            pos,
        };
    }

    isNumber(desc: {
        isNumber: boolean;
        isDecimal: boolean;
        pos: number;
    }) {
        return desc.isNumber
    }

    isDecimal(desc: {
        isNumber: boolean;
        isDecimal: boolean;
        pos: number;
    }) {
        return desc.isDecimal
    }

    isNumberal(desc: {
        isNumber: boolean;
        isDecimal: boolean;
        pos: number;
    }) {
        return this.isNumber(desc) || this.isDecimal(desc);
    }

    validate(expression: string) {
      this.expression = expression;
      this.currentState = this.states.START;
      this.position = 0;
      this.currentContext = null;
      this.contexts.length = 0;
      this.parenCount = 0;
      this.stack.length = 0;
      while(this.position < expression.length) {
        const char = expression[this.position];
        if(/\s/.test(char) && ![this.states.ANNUALIZED_DEFINE].includes(this.currentState)) {
            this.position++;
            continue;
        }
        switch (this.currentState) {
            case this.states.START:
            if (this.isDigit(char)) {
              const desc = this.getNumberDesc(this.position);
              if(!this.isNumberal(desc)) {
                return this.error(`不期望的字符在${desc.pos}列：${char}`);
              } else {
                this.currentState = this.isNumber(desc) ? this.states.NUMBER : this.states.DECIMAL;
                this.position = desc.pos;
                continue;
              }
            } else if (char === '(') {
              this.currentState = this.states.LEFT_PAREN;
              this.contexts.push({
                name: 'bracket',
                from: this.position,
                to: this.position,
                done: false,
                value: null,
              });
              this.parenCount++;
              this.currentState = this.states.START;
            } else if (char === '-' || char === '+') {
              this.currentState = this.states.SIGN;
            } else if(DEFINES.some((item) => item[0]===char)) {
              const define = DEFINES.find(item => item === expression.slice(this.position, this.position + item.length));
              if(define) {
                this.contexts.push({
                    name: define as DefineModel['name'],
                    from: this.position,
                    to: this.position + define.length,
                    done: true,
                    value: null,
                })
                this.currentState = this.states.INDEX_DEFINE;
                this.position+=define.length;
                this.currentState = this.states.NUMBER;
                continue;
              } else {
                return this.error(`不期望的字符在${this.position}列：${char}`);
              }
            } else if(MAX_REGEXP_DEFINE.some((item) => item[0]===char) || MIN_REGEXP_DEFINE.some((item) => item[0]===char)) {
                const define = [...MAX_REGEXP_DEFINE, ...MIN_REGEXP_DEFINE].find(item => item === expression.slice(this.position, this.position + item.length));
                if(define) {
                  this.contexts.push({
                      name: define === 'Max(' ? 'Max(,)' : 'Min(,)',
                      from: this.position,
                      to: this.position + define.length,
                      done: false,
                      value: null,
                  })
                  this.currentState = define === 'Max(' ? this.states.MAX_DEFINE : this.states.MIN_DEFINE;
                  this.position+=define.length;
                  this.currentState = this.states.START;
                  continue;
                } else {
                  return this.error(`不期望的字符在${this.position}列：${char}`);
                }
            } else if(ANNUALIZED_REGEXP_DEFINE.some((item) => item[0]===char)) {
                const define = ANNUALIZED_REGEXP_DEFINE.find(item => item === expression.slice(this.position, this.position + item.length));
                if(define) {
                  this.contexts.push({
                      name: '年化利率%',
                      from: this.position,
                      to: this.position + define.length,
                      done: false,
                      value: null,
                  })
                  this.currentState = this.states.ANNUALIZED_DEFINE;
                  this.position+=define.length;
                  continue;
                } else {
                  return this.error(`不期望的字符在${this.position}列：${char}`);
                }
            } else {
              return this.error('Unexpected character at start');
            }
            break;
  
          case this.states.NUMBER:
              if (this.isOperator(char)) {
              this.currentState = this.states.OPERATOR;
            } else if(char === '%') {
                const anunalizedContext = this.getUnDoneContext('年化利率%');
                if(anunalizedContext) {
                    this.updateContextToDone(anunalizedContext, this.position);
                    this.currentState = this.states.ANNUALIZED_DEFINE_END;
                    this.currentState = this.states.NUMBER;
                    break;
                } else {
                    return this.error('Unexpected character after number');
                  }
            }  else if(char === ',') {
                const maxContext = this.getUnDoneContext('Max(,)');
                const minContext = this.getUnDoneContext('Min(,)');
                if(maxContext || minContext) {
                    this.currentState = this.states.MAX_MIN_DEFINE_SPLIT;
                    this.currentState = this.states.START;
                } else {
                    return this.error('Unexpected character after decimal');
                }
            } else if (char === ')') {
              const brackContext = this.getUnDoneContext('bracket');
              if (brackContext) {
                this.currentState = this.states.RIGHT_PAREN;
                this.updateContextToDone(brackContext, this.position);
                this.parenCount--;
                break;
              }
              const minContext = this.getUnDoneContext('Min(,)');
              if (minContext) {
                this.currentState = this.states.RIGHT_PAREN;
                this.updateContextToDone(minContext, this.position);
                break;
              }
              const maxContext = this.getUnDoneContext('Max(,)');
              if (maxContext) {
                this.currentState = this.states.RIGHT_PAREN;
                this.updateContextToDone(maxContext, this.position);
                break;
              }
              if(!brackContext && !minContext && !maxContext) {
                return this.error('Unexpected character after number');
              }
            } else {
              return this.error('Unexpected character after number');
            }
            break;
  
          case this.states.DECIMAL:
            if (this.isOperator(char)) {
              this.currentState = this.states.OPERATOR;
            } else if(char === '%') {
                const anunalizedContext = this.getUnDoneContext('年化利率%');
                if(anunalizedContext) {
                    this.updateContextToDone(anunalizedContext, this.position);
                    this.currentState = this.states.ANNUALIZED_DEFINE_END;
                    this.currentState = this.states.NUMBER;
                    break;
                } else {
                    return this.error('Unexpected character after decimal');
                  }
            }  else if(char === ',') {
                const maxContext = this.getUnDoneContext('Max(,)');
                const minContext = this.getUnDoneContext('Min(,)');
                if(maxContext || minContext) {
                    this.currentState = this.states.MAX_MIN_DEFINE_SPLIT;
                    this.currentState = this.states.START;
                } else {
                    return this.error('Unexpected character after decimal');
                }
            } else if (char === ')') {
                const brackContext = this.getUnDoneContext('bracket');
                if (brackContext) {
                  this.currentState = this.states.RIGHT_PAREN;
                  this.updateContextToDone(brackContext, this.position);
                  this.parenCount--;
                  break;
                }
                const minContext = this.getUnDoneContext('Min(,)');
                if (minContext) {
                  this.currentState = this.states.RIGHT_PAREN;
                  this.updateContextToDone(minContext, this.position);
                  break;
                }
                const maxContext = this.getUnDoneContext('Max(,)');
                if (maxContext) {
                  this.currentState = this.states.RIGHT_PAREN;
                  this.updateContextToDone(maxContext, this.position);
                  break;
                }
                if(!brackContext && !minContext && !maxContext) {
                    return this.error('Unexpected character after number');
                  }
            } else {
              return this.error('Unexpected character after decimal');
            }
            break;
  
          case this.states.OPERATOR:
            if (this.isDigit(char)) {
                const desc = this.getNumberDesc(this.position);
                if(!this.isNumberal(desc)) {
                  return this.error(`不期望的字符在${desc.pos}列：${char}`);
                } else {
                  this.currentState = this.isNumber(desc) ? this.states.NUMBER : this.states.DECIMAL;
                  this.position = desc.pos;
                  continue;
                }
            } else if (char === '(') {
              this.currentState = this.states.LEFT_PAREN;
              this.contexts.push({
                name: 'bracket',
                from: this.position,
                to: this.position,
                done: false,
                value: null,
              });
              this.parenCount++;
            } else if(DEFINES.some((item) => item[0]===char)) {
                const define = DEFINES.find(item => item === expression.slice(this.position, this.position + item.length));
                if(define) {
                  this.contexts.push({
                      name: define as DefineModel['name'],
                      from: this.position,
                      to: this.position + define.length,
                      done: true,
                      value: null,
                  })
                  this.currentState = this.states.INDEX_DEFINE;
                  this.position+=define.length;
                  this.currentState = this.states.NUMBER;
                  continue;
                } else {
                  return this.error(`不期望的字符在${this.position}列：${char}`);
                }
              } else if(MAX_REGEXP_DEFINE.some((item) => item[0]===char) || MIN_REGEXP_DEFINE.some((item) => item[0]===char)) {
                  const define = [...MAX_REGEXP_DEFINE, ...MIN_REGEXP_DEFINE].find(item => item === expression.slice(this.position, this.position + item.length));
                  if(define) {
                    this.contexts.push({
                        name: define === 'Max(' ? 'Max(,)' : 'Min(,)',
                        from: this.position,
                        to: this.position + define.length,
                        done: false,
                        value: null,
                    })
                    this.currentState = define === 'Max(' ? this.states.MAX_DEFINE : this.states.MIN_DEFINE;
                    this.position+=define.length;
                    this.currentState = this.states.START;
                    continue;
                  } else {
                    return this.error(`不期望的字符在${this.position}列：${char}`);
                  }
              } else if(ANNUALIZED_REGEXP_DEFINE.some((item) => item[0]===char)) {
                  const define = ANNUALIZED_REGEXP_DEFINE.find(item => item === expression.slice(this.position, this.position + item.length));
                  if(define) {
                    this.contexts.push({
                        name: '年化利率%',
                        from: this.position,
                        to: this.position + define.length,
                        done: false,
                        value: null,
                    })
                    this.currentState = this.states.ANNUALIZED_DEFINE;
                    this.position+=define.length;
                    continue;
                  } else {
                    return this.error(`不期望的字符在${this.position}列：${char}`);
                  }
              } else {
              return this.error('Unexpected character after operator');
            }
            break;
        //   不跳到这里判断
          case this.states.LEFT_PAREN:
            if (this.isDigit(char)) {
                const desc = this.getNumberDesc(this.position);
                if(!this.isNumberal(desc)) {
                  return this.error(`不期望的字符在${desc.pos}列：${char}`);
                } else {
                  this.currentState = this.isNumber(desc) ? this.states.NUMBER : this.states.DECIMAL;
                  this.position = desc.pos;
                  continue;
                }
            } else if (char === '(') {
              this.currentState = this.states.LEFT_PAREN;
              this.contexts.push({
                name: 'bracket',
                from: this.position,
                to: this.position,
                done: false,
                value: null,
              });
              this.parenCount++;
            } else if (char === '-' || char === '+') {
              this.currentState = this.states.SIGN;
            } else {
              return this.error('Unexpected character after left parenthesis');
            }
            break;
  
          case this.states.RIGHT_PAREN:
            if (this.isOperator(char)) {
              this.currentState = this.states.OPERATOR;
            } else if (char === ')') {
                const brackContext = this.getUnDoneContext('bracket');
                if (brackContext) {
                  this.currentState = this.states.RIGHT_PAREN;
                  this.updateContextToDone(brackContext, this.position);
                  this.parenCount--;
                  break;
                }
                const minContext = this.getUnDoneContext('Min(,)');
                if (minContext) {
                  this.currentState = this.states.RIGHT_PAREN;
                  this.updateContextToDone(minContext, this.position);
                  break;
                }
                const maxContext = this.getUnDoneContext('Max(,)');
                if (maxContext) {
                  this.currentState = this.states.RIGHT_PAREN;
                  this.updateContextToDone(maxContext, this.position);
                  break;
                }
                if(!brackContext && !minContext && !maxContext) {
                    return this.error('Unexpected character after number');
                  }
            }   else if(char === ',') {
                const maxContext = this.getUnDoneContext('Max(,)');
                const minContext = this.getUnDoneContext('Min(,)');
                if(maxContext || minContext) {
                    this.currentState = this.states.MAX_MIN_DEFINE_SPLIT;
                    this.currentState = this.states.START;
                } else {
                    return this.error('Unexpected character after decimal');
                }
            } else {
              return this.error('Unexpected character after right parenthesis');
            }
            break;
  
          case this.states.SIGN:
            if (this.isDigit(char)) {
                const desc = this.getNumberDesc(this.position);
                if(!this.isNumberal(desc)) {
                  return this.error(`不期望的字符在${desc.pos}列：${char}`);
                } else {
                  this.currentState = this.isNumber(desc) ? this.states.NUMBER : this.states.DECIMAL;
                  this.position = desc.pos;
                  continue;
                }
            } else if (char === '(') {
              this.currentState = this.states.LEFT_PAREN;
              this.contexts.push({
                name: 'bracket',
                from: this.position,
                to: this.position,
                done: false,
                value: null,
              });
              this.parenCount++;
              this.currentState = this.states.START;
            } else {
              return this.error('Unexpected character after sign');
            }
            break;
  
          case this.states.INDEX_DEFINE: {
            // dont go to here
            break;
          }
          case this.states.ANNUALIZED_DEFINE: {
            if (this.isDigit(char)) {
                const desc = this.getNumberDesc(this.position);
                if(!this.isNumberal(desc)) {
                  return this.error(`不期望的字符在${desc.pos}列：${char}`);
                } else {
                  this.currentState = this.isNumber(desc) ? this.states.NUMBER : this.states.DECIMAL;
                  this.position = desc.pos;
                  continue;
                }
            } else {
                return this.error('Unexpected character after sign');
            }
          }
          case this.states.ANNUALIZED_DEFINE_END: {
            // dont go to here
            break;
          }
          case this.states.MAX_DEFINE: {
            // dont go to here
            break;
          }
          case this.states.MIN_DEFINE: {
            // dont go to here
            break;
          }
          case this.states.MAX_MIN_DEFINE_SPLIT: {
            // dont go to here
            break;
          }
          default:
            return this.error('Unknown state');
        }
        this.position++
      }
  
      // Final validation
      if (this.parenCount !== 0) {
        return this.error('Unmatched parentheses');
      }
      if (this.currentState === this.states.OPERATOR || this.currentState === this.states.SIGN) {
        return this.error('Expression cannot end with an operator or sign');
      }
  
      return { isValid: true, message: 'Valid expression', contexts: this.contexts.slice(), expression: this.expression.slice(), };
    }
  
    isDigit(char: string) {
      return char >= '0' && char <= '9';
    }
  
    isOperator(char: string) {
      return ['+', '-', '*', '/'].includes(char);
    }
  
    error(message: string) {
      return { isValid: false, message: message, position: this.position, contexts: this.contexts.slice(), expression: this.expression.slice(), };
    }
  }
  
  // 测试用例
  const validator = new ExpressionValidator();
  console.log(validator.validate('3+5')); // { isValid: true, message: 'Valid expression' }
  console.log(validator.validate('3++5')); // { isValid: false, message: 'Unexpected character after operator', position: 2 }
  console.log(validator.validate('(3+5)*2')); // { isValid: true, message: 'Valid expression' }
  console.log(validator.validate('3+5)')); // { isValid: false, message: 'Unmatched parentheses', position: 3 }
  console.log(validator.validate('3..5')); // { isValid: false, message: 'Unexpected character after decimal', position: 2 }
  
  console.log(validator.validate('Max(沪深300 * 60% , Min(中证500), 1)')); // { isValid: true, message: 'Valid expression' }
  console.log(validator.validate('Max(沪深300 * 60% , Min(中证500) + 4, 1) + 5')); // { isValid: false, message: 'Unexpected character after operator', position: 2 }
  console.log(validator.validate('Max(沪深300 * 60% , Min(中证500) + 4, 1,) + 5')); // { isValid: false, message: 'Unexpected character after operator', position: 2 }
  