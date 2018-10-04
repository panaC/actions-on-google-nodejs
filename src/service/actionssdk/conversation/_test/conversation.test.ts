/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import test from 'ava'
import { Conversation } from '../conversation'
import * as Api from '../../api/v2'
import { BasicCard, Button, Suggestions, SimpleResponse } from '..'
import { clone } from '../../../../common'

const CONVERSATION_ID = '1234'
const USER_ID = 'abcd'

function buildRequest(
  convType: string, intent: string, data?: {}): Api.GoogleActionsV2AppRequest {
  const appRequest = {
    conversation: {
      conversationId: CONVERSATION_ID,
      type: convType,
      conversationToken: data,
    },
    user: {
      userId: USER_ID,
      locale: 'en_US',
    },
    inputs: [
      {
        intent,
        rawInputs: [
          {
            inputType: 'KEYBOARD',
            query: 'Talk to my test app',
          },
        ],
      },
    ],
    surface: {
      capabilities: [
        {
          name: 'actions.capability.SCREEN_OUTPUT',
        },
        {
          name: 'actions.capability.MEDIA_RESPONSE_AUDIO',
        },
        {
          name: 'actions.capability.WEB_BROWSER',
        },
        {
          name: 'actions.capability.AUDIO_OUTPUT',
        },
      ],
    },
    availableSurfaces: [
      {
        capabilities: [
          {
            name: 'actions.capability.SCREEN_OUTPUT',
          },
          {
            name: 'actions.capability.AUDIO_OUTPUT',
          },
        ],
      },
    ],
  } as Api.GoogleActionsV2AppRequest
  return appRequest
}

test('conv.screen is true when screen capability exists', t => {
  const conv = new Conversation({
    request: {
      surface: {
        capabilities: [
          {
            name: 'actions.capability.SCREEN_OUTPUT',
          },
        ],
      },
    },
  })
  t.true(conv.screen)
})

test('conv.screen is false when screen capability does not exist', t => {
  const conv = new Conversation({
    request: {
      surface: {
        capabilities: [
        ],
      },
    },
  })
  t.false(conv.screen)
})

test('ask with simple text', t => {
  const appRequest = buildRequest('ACTIVE', 'example.foo')
  const conv = new Conversation({
    request: appRequest,
  })

  conv.ask('hello')

  t.true(conv.expectUserResponse)
  t.is(conv.responses.length, 1)
  t.false(conv.digested)
  t.true(conv._responded)
})

test('ask with multiple responses', t => {
  const appRequest = buildRequest('ACTIVE', 'example.foo')
  const conv = new Conversation({
    request: appRequest,
  })

  conv.ask('hello', 'world', '<speak>hello world</speak>')

  t.true(conv.expectUserResponse)
  t.is(conv.responses.length, 3)
  t.false(conv.digested)
  t.true(conv._responded)
})

test('close with multiple responses', t => {
  const appRequest = buildRequest('ACTIVE', 'example.foo')
  const conv = new Conversation({
    request: appRequest,
  })

  conv.close('hello', 'world', '<speak>hello world</speak>')

  t.false(conv.expectUserResponse)
  t.is(conv.responses.length, 3)
  t.false(conv.digested)
  t.true(conv._responded)
})

test('basic conversation response', t => {
  const appRequest = buildRequest('ACTIVE', 'example.foo')
  const conv = new Conversation({
    request: appRequest,
  })

  conv.ask('hello', '<speak>world</speak>')
  const response = conv.response()

  t.is(response.richResponse.items!.length, 2)
  t.deepEqual(response.richResponse.items![0].simpleResponse!.textToSpeech,
    'hello')
  t.deepEqual(response.richResponse.items![1].simpleResponse!.textToSpeech,
    '<speak>world</speak>')
  t.true(response.expectUserResponse)
  t.true(conv.digested)
  t.true(conv._responded)
})

test('basic card with suggestions conversation response', t => {
  const appRequest = buildRequest('ACTIVE', 'example.foo')
  const conv = new Conversation({
    request: appRequest,
  })

  conv.ask(
    'hello',
    new BasicCard({
      title: 'Title',
      subtitle: 'This is a subtitle',
      text: 'This is a sample text',
      image: {
        url: 'http://url/to/image',
        height: 200,
        width: 300,
      },
      buttons: new Button({
        title: 'Learn more',
        url: 'http://url/to/open',
      }),
    }),
    new Suggestions('suggestion one', 'suggestion two'))

  const response = conv.response()

  t.is(response.richResponse.items!.length, 2)
  t.deepEqual(response.richResponse.items![1].basicCard!.formattedText,
    'This is a sample text')
  t.deepEqual(response.richResponse.suggestions![0].title, 'suggestion one')
  t.true(response.expectUserResponse)
  t.true(conv.digested)
  t.true(conv._responded)
})

test('basic conversation response with reprompts', t => {
  const appRequest = buildRequest('ACTIVE', 'example.foo')
  const conv = new Conversation({
    request: appRequest,
  })

  conv.ask('hello')
  conv.noInputs = ['reprompt1', new SimpleResponse('reprompt2')]
  const response = conv.response()

  t.is(response.richResponse.items!.length, 1)
  t.deepEqual(response.richResponse.items![0].simpleResponse!.textToSpeech,
    'hello')
  t.deepEqual(response.noInputPrompts![0].textToSpeech, 'reprompt1')
  t.deepEqual(response.noInputPrompts![1].textToSpeech, 'reprompt2')
  t.true(response.expectUserResponse)
  t.true(conv.digested)
  t.true(conv._responded)
})

test('conv parses a valid user storage', t => {
  const data = {
    a: '1',
    b: '2',
    c: {
      d: '3',
      e: '4',
    },
  }
  const conv = new Conversation({
    request: {
      user: {
        userStorage: JSON.stringify({ data }),
      },
    },
  })
  t.deepEqual(conv.user.storage, data)
})

test('conv generate an empty user storage as empty string', t => {
  const response = `What's up?`
  const conv = new Conversation()
  t.deepEqual(conv.user.storage, {})
  conv.ask(response)
  t.deepEqual(clone(conv.response()), {
    expectUserResponse: true,
    richResponse: {
      items: [
        {
          simpleResponse: {
            textToSpeech: response,
          },
        },
      ],
    },
    userStorage: '',
  })
})

test('conv generates first user storage replaced correctly', t => {
  const response = `What's up?`
  const data = {
    a: '1',
    b: '2',
    c: {
      d: '3',
      e: '4',
    },
  }
  const conv = new Conversation()
  conv.ask(response)
  conv.user.storage = data
  t.deepEqual(clone(conv.response()), {
    expectUserResponse: true,
    richResponse: {
      items: [
        {
          simpleResponse: {
            textToSpeech: response,
          },
        },
      ],
    },
    userStorage: JSON.stringify({ data }),
  })
})

test('conv generates first user storage mutated correctly', t => {
  const response = `What's up?`
  const conv = new Conversation<{ a: string }>()
  conv.ask(response)
  const a = '1'
  conv.user.storage.a = a
  t.deepEqual(clone(conv.response()), {
    expectUserResponse: true,
    richResponse: {
      items: [
        {
          simpleResponse: {
            textToSpeech: response,
          },
        },
      ],
    },
    userStorage: JSON.stringify({ data: { a } }),
  })
})

test('conv generates different user storage correctly', t => {
  const response = `What's up?`
  const data = {
    a: '1',
    b: '2',
    c: {
      d: '3',
      e: '4',
    },
  }
  const e = '6'
  const conv = new Conversation<typeof data>({
    request: {
      user: {
        userStorage: JSON.stringify({ data }),
      },
    },
  })
  t.deepEqual(conv.user.storage, data)
  conv.ask(response)
  conv.user.storage.c.e = e
  t.deepEqual(clone(conv.response()), {
    expectUserResponse: true,
    richResponse: {
      items: [
        {
          simpleResponse: {
            textToSpeech: response,
          },
        },
      ],
    },
    userStorage: JSON.stringify({
      data: {
        a: '1',
        b: '2',
        c: {
          d: '3',
          e,
        },
      },
    }),
  })
})

test('conv generates same user storage as empty string', t => {
  const response = `What's up?`
  const data = {
    a: '1',
    b: '2',
    c: {
      d: '3',
      e: '4',
    },
  }
  const conv = new Conversation({
    request: {
      user: {
        userStorage: JSON.stringify({ data }),
      },
    },
  })
  t.deepEqual(conv.user.storage, data)
  conv.ask(response)
  t.deepEqual(clone(conv.response()), {
    expectUserResponse: true,
    richResponse: {
      items: [
        {
          simpleResponse: {
            textToSpeech: response,
          },
        },
      ],
    },
    userStorage: '',
  })
})
