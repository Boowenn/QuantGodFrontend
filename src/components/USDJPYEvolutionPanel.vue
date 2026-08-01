<template>
  <section class="qg-usdjpy-evolution">
    <header class="qg-usdjpy-evolution__header">
      <div>
        <p class="qg-usdjpy-evolution__eyebrow">USDJPY Shadow / ReadOnly 研究闭环</p>
        <h2>数据集、因果回放、前向验证与只读治理</h2>
        <p>
          每天把 EA 守门、错失机会、过早出场和参数候选整理成证据；本页不生成执行授权，所有结果保持 Shadow /
          ReadOnly。
        </p>
      </div>
      <div class="qg-usdjpy-evolution__actions">
        <div class="qg-usdjpy-evolution__primary-actions">
          <button
            type="button"
            class="qg-usdjpy-evolution__button--primary"
            :disabled="loading"
            @click="load"
          >
            刷新证据
          </button>
          <button
            type="button"
            class="qg-usdjpy-evolution__button--primary"
            :disabled="loading"
            @click="runGAGeneration"
          >
            运行遗传进化
          </button>
          <button type="button" :disabled="loading" @click="runFullEvolution">生成复盘闭环</button>
        </div>
        <details class="qg-usdjpy-evolution__more-actions">
          <summary>更多证据动作</summary>
          <div>
            <button type="button" :disabled="loading" @click="runCausalReplay">生成回放证据</button>
            <button type="button" :disabled="loading" @click="runAutonomousGovernance">运行治理门</button>
            <button type="button" :disabled="loading" @click="runDailyAutopilotV2">生成自动日报</button>
            <button type="button" :disabled="loading" @click="runStrategyBacktest">运行回测证据</button>
            <button type="button" :disabled="loading" @click="runEvidenceOS">生成证据系统</button>
            <button type="button" :disabled="loading" @click="runCaseMemoryBuild">生成经验候选</button>
            <button type="button" :disabled="loading" @click="runGAFactoryBuild">生成 GA 工厂</button>
            <button type="button" :disabled="loading" @click="runStrategyFactoryIntentPlan()">
              生成大白话策略
            </button>
            <button type="button" :disabled="loading" @click="runTelegramGatewayOpsCollect">
              收集通知报告
            </button>
            <button type="button" :disabled="loading" @click="runStrategyContract">生成 EA 契约</button>
          </div>
        </details>
      </div>
    </header>

    <div
      v-if="actionStatus"
      class="qg-usdjpy-evolution__action-result"
      :class="`qg-usdjpy-evolution__action-result--${actionStatus.kind}`"
      role="status"
    >
      <div>
        <strong>{{ actionStatus.title }}</strong>
        <span>{{ actionStatus.time }}</span>
      </div>
      <p>{{ actionStatus.summary }}</p>
    </div>

    <div v-if="loading" class="qg-usdjpy-evolution__state">正在读取 USDJPY 自学习证据...</div>
    <div v-else-if="error" class="qg-usdjpy-evolution__state qg-usdjpy-evolution__state--error">
      {{ error }}
    </div>
    <div v-else class="qg-usdjpy-evolution__grid">
      <article class="qg-usdjpy-evolution__card qg-usdjpy-evolution__card--featured">
        <span>运行数据集</span>
        <strong>{{ datasetSummary.sampleCount || 0 }}</strong>
        <p>
          候选 {{ datasetSummary.readySignalCount || 0 }} / 历史成交证据
          {{ datasetSummary.actualEntryCount || 0 }} / 阻断 {{ datasetSummary.blockedCount || 0 }}
        </p>
      </article>
      <article class="qg-usdjpy-evolution__card">
        <span>回放复盘</span>
        <strong>{{ replayStatus }}</strong>
        <p>
          错失 {{ replaySummary.missedOpportunityCount || 0 }} / 过早出场
          {{ replaySummary.earlyExitCount || 0 }}
        </p>
      </article>
      <article class="qg-usdjpy-evolution__card">
        <span>参数候选</span>
        <strong>{{ tuningSummary.candidateCount || 0 }}</strong>
        <p>{{ tuning?.statusZh || '等待回放数据生成候选' }}</p>
      </article>
      <article class="qg-usdjpy-evolution__card">
        <span>自主治理代理</span>
        <strong>{{
          autonomousAgent?.stageZh || autonomousAgent?.stage || proposal?.statusZh || '等待治理门'
        }}</strong>
        <p>{{ patchWritable ? '已允许写入受控 patch' : '未放行 patch' }}；不会改源码或 live preset。</p>
      </article>
      <article class="qg-usdjpy-evolution__card">
        <span>EA 对账</span>
        <strong>{{ eaRepro.statusZh || '等待对账' }}</strong>
        <p>源码 / ex5 / preset hash 只读校验；Watchlist 期望 USDJPY-only。</p>
      </article>
      <article class="qg-usdjpy-evolution__card">
        <span>Parity 校验</span>
        <strong>{{ deepParityStatusZh }}</strong>
        <p>策略契约 / Python 回放 / EA 三方口径审计，不通过不能晋级。</p>
      </article>
      <article class="qg-usdjpy-evolution__card">
        <span>影子 / 历史反馈</span>
        <strong>{{ executionGateStatusZh }}</strong>
        <p>
          样本 {{ executionMetrics.feedbackRows || 0 }} / 阻断 {{ executionBlockers.length }} / 警告
          {{ executionWarnings.length }}
        </p>
      </article>
      <article class="qg-usdjpy-evolution__card">
        <span>通知网关</span>
        <strong>{{ telegramGateway.pendingCount || 0 }} 待投递</strong>
        <p>
          已投递 {{ telegramGateway.deliveredCount || 0 }}；队列
          {{ telegramGateway.queuedCount || 0 }}；去重、限频、 ledger 已接入。
        </p>
      </article>
    </div>

    <template v-if="!loading && !error">
      <div class="qg-usdjpy-evolution__chapter-label qg-usdjpy-evolution__chapter-label--learning">
        <span>01</span>
        <div>
          <strong>自学习闭环</strong>
          <p>先看数据集、因果回放、参数候选和前向验证。</p>
        </div>
      </div>
      <div class="qg-usdjpy-evolution__chapter-label qg-usdjpy-evolution__chapter-label--safety">
        <span>02</span>
        <div>
          <strong>治理与安全</strong>
          <p>再确认 Shadow 生命周期、硬门禁、自动日报和受控 patch 状态。</p>
        </div>
      </div>
      <div class="qg-usdjpy-evolution__chapter-label qg-usdjpy-evolution__chapter-label--ga">
        <span>03</span>
        <div>
          <strong>GA 进化审计</strong>
          <p>集中查看代际、候选、血统、策略契约和高保真回测。</p>
        </div>
      </div>
      <div class="qg-usdjpy-evolution__chapter-label qg-usdjpy-evolution__chapter-label--execution">
        <span>04</span>
        <div>
          <strong>影子与历史证据</strong>
          <p>最后展开影子评估、历史兼容反馈、经验记忆、通知网关和生产证据。</p>
        </div>
      </div>
    </template>

    <section v-if="lanes" class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--lanes">
      <div class="qg-usdjpy-evolution__section-head">
        <div>
          <h3>Shadow / ReadOnly 生命周期</h3>
          <p>Shadow 建议证据要严，模拟研究要宽，升降级与回滚都只生成治理证据。</p>
        </div>
        <strong>{{
          autonomousLifecycle?.singleSourceOfTruth || 'USDJPY_LIVE_LOOP_WITH_AUTONOMOUS_LIFECYCLE'
        }}</strong>
      </div>
      <div class="qg-usdjpy-evolution__scenario-grid">
        <article>
          <span>Shadow Advisory 车道</span>
          <strong>{{ liveLane.strategy || '证据不可用' }} / {{ directionZh(liveLane.direction) }}</strong>
          <p>旧 liveLane 字段仅展示 USDJPYc 影子建议；当前没有 execution lane。</p>
        </article>
        <article>
          <span>MT5 模拟车道</span>
          <strong>{{ mt5ShadowSummary.topShadowStrategy || '多策略观察' }}</strong>
          <p>模拟池包含 RSI、MA、BB、MACD、S/R、东京突破、夜盘回归和 H4 回调。</p>
        </article>
        <article>
          <span>自动回滚</span>
          <strong>{{ rollbackBlockers.length ? '已触发' : '待命' }}</strong>
          <p>
            {{
              rollbackBlockers[0] || '连续亏损、日亏损、快通道、runtime、点差和高冲击新闻是不可放宽硬门禁。'
            }}
          </p>
        </article>
      </div>
      <p class="qg-usdjpy-evolution__note">
        MT5 Shadow 第一名只用于研究；DeepSeek 只解释，不批准越权或执行。
      </p>
    </section>

    <section v-if="autonomousAgent" class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--agent">
      <div class="qg-usdjpy-evolution__section-head">
        <div>
          <h3>自主治理代理</h3>
          <p>代理只能生成受控研究补丁与治理证据；硬风控失败时保持阻断，不产生执行授权。</p>
        </div>
        <strong>{{ autonomousAgent.stageZh || autonomousAgent.stage || '等待状态' }}</strong>
      </div>
      <div class="qg-usdjpy-evolution__scenario-grid">
        <article>
          <span>当前阶段</span>
          <strong>{{ autonomousAgent.stageZh || autonomousAgent.stage || '—' }}</strong>
          <p>USDJPY-only；当前只显示 Shadow / ReadOnly 路线证据。</p>
        </article>
        <article>
          <span>受控 patch</span>
          <strong>{{ patchWritable ? '已放行' : '未放行' }}</strong>
          <p>{{ patchChangeText }}</p>
        </article>
        <article>
          <span>自动回滚</span>
          <strong>{{ rollbackBlockers.length ? `${rollbackBlockers.length} 项` : '未触发' }}</strong>
          <p>
            {{ rollbackBlockers[0] || '连续亏损、日亏损、快通道、runtime、点差和高冲击新闻仍是硬门禁。' }}
          </p>
        </article>
        <article>
          <span>研究 lot 上限（兼容字段）</span>
          <strong>{{ metricText(agentLimits.stageMaxLot) }} / {{ metricText(agentLimits.maxLot) }}</strong>
          <p>当前阶段 / 系统研究估计；任何数值都不能成为 broker order 参数。</p>
        </article>
        <article>
          <span>美分账户</span>
          <strong
            >{{ centAccount.accountMode || '证据不可用' }} /
            {{ centAccount.accountCurrencyUnit || '证据不可用' }}</strong
          >
          <p>
            加速 {{ booleanEvidenceText(centAccount.centAccountAcceleration) }}；最大
            {{ metricText(centAccount.maxLot) }} 是上限，不是固定仓位。
          </p>
        </article>
      </div>
      <p class="qg-usdjpy-evolution__note">
        DeepSeek 只解释研究晋级和回滚原因；当前没有可批准的 live lane，也不能取消回滚、修改 preset
        或放宽点差/runtime/高冲击新闻门禁。
      </p>
    </section>

    <section v-if="dailyAutopilot" class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--daily">
      <div class="qg-usdjpy-evolution__section-head">
        <div>
          <h3>自动日报 2.0</h3>
          <p>自动中文早盘计划、今日待办和每日复盘；已完成事项由自主代理自动闭环。</p>
        </div>
        <strong>{{
          agentDailyTodo?.status ||
          dailyAutopilot.dailyTodo?.status ||
          dailyAutopilot.autonomousAgent?.stageZh ||
          '自主评估'
        }}</strong>
      </div>
      <div class="qg-usdjpy-evolution__scenario-grid">
        <article>
          <span>今日待办</span>
          <strong>{{
            agentDailyTodo?.completedByAgent || dailyAutopilot.dailyTodo?.completedByAgent
              ? '已自动完成'
              : '等待自主代理'
          }}</strong>
          <p>
            {{ dailyTodoItems.length }} 项；
            {{
              agentDailyTodo?.autoAppliedByAgent || dailyAutopilot.dailyTodo?.autoAppliedByAgent
                ? '已自动推动阶段/补丁'
                : '无需自动推动'
            }}；
            {{
              agentDailyTodo?.rollbackTriggered || dailyAutopilot.dailyTodo?.rollbackTriggered
                ? '已触发回滚'
                : '未触发回滚'
            }}
          </p>
        </article>
        <article>
          <span>每日复盘</span>
          <strong>{{
            agentDailyReview?.completedByAgent || dailyAutopilot.dailyReview?.completedByAgent
              ? '已自动复盘'
              : '等待复盘'
          }}</strong>
          <p>
            净 R {{ metricText(dailyReviewMetrics.netR) }}； 最大不利
            {{ metricText(dailyReviewMetrics.maxAdverseR, 'R') }}； 错失
            {{ metricText(dailyReviewMetrics.missedOpportunity) }}
          </p>
        </article>
        <article>
          <span>早盘 Shadow 观察计划</span>
          <strong>{{ dailyAutopilot.morningPlan?.liveLane?.strategy || '证据不可用' }}</strong>
          <p>
            {{ dailyAutopilot.morningPlan?.liveLane?.symbol || '证据不可用' }}
            {{ directionZh(dailyAutopilot.morningPlan?.liveLane?.direction) }}； 研究 lot
            {{ metricText(dailyAutopilot.morningPlan?.liveLane?.stageMaxLot) }} / 上限
            {{ metricText(dailyAutopilot.morningPlan?.liveLane?.maxLot) }}
          </p>
        </article>
        <article>
          <span>MT5 模拟日报</span>
          <strong
            >{{
              dailyAutopilot.eveningReview?.mt5ShadowLane?.routeCount || mt5ShadowSummary.routeCount || 0
            }}
            条路线</strong
          >
          <p>
            晋级/强化 {{ dailyAutopilot.eveningReview?.mt5ShadowLane?.promotedCount || 0 }}，暂停
            {{ dailyAutopilot.eveningReview?.mt5ShadowLane?.pausedCount || 0 }}，淘汰
            {{ dailyAutopilot.eveningReview?.mt5ShadowLane?.rejectedCount || 0 }}
          </p>
        </article>
        <article>
          <span>今日硬禁止</span>
          <strong>{{ dailyAutopilot.morningPlan?.todayForbiddenZh?.length || 0 }} 项</strong>
          <p>
            {{
              dailyAutopilot.morningPlan?.todayForbiddenZh?.[0] ||
              '高冲击新闻、点差、runtime 和快通道门禁不可放宽。'
            }}
          </p>
        </article>
        <article>
          <span>新闻门禁日报</span>
          <strong>{{ dailyAutopilot.morningPlan?.newsGate?.mode || newsGate.mode || 'SOFT' }}</strong>
          <p>
            {{
              dailyAutopilot.morningPlan?.newsGate?.reasonZh ||
              newsGate.reasonZh ||
              '普通新闻不阻断，只降仓；高冲击新闻硬阻断。'
            }}
          </p>
        </article>
        <article>
          <span>下一阶段任务</span>
          <strong>{{ statusZh(nextPhaseTodos.status, '自主代理已接入') }}</strong>
          <p>策略契约、遗传进化与通知网关已接入；后续继续补真实样本、一致性和执行质量。</p>
        </article>
      </div>
      <div v-if="dailyTodoItems.length" class="qg-usdjpy-evolution__mini-list">
        <article v-for="item in dailyTodoItems.slice(0, 6)" :key="item.id">
          <span>{{ item.laneZh || item.lane }}</span>
          <strong>{{ statusZh(item.status) }}</strong>
          <p>{{ item.summaryZh }}</p>
        </article>
      </div>
      <div v-if="nextPhaseItems.length" class="qg-usdjpy-evolution__mini-list">
        <article v-for="item in nextPhaseItems" :key="item.id">
          <span>{{ item.titleZh || item.id }}</span>
          <strong>{{ statusZh(item.status) }}</strong>
          <p>{{ item.summaryZh }}</p>
        </article>
      </div>
    </section>

    <section v-if="barReplay" class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--causal">
      <div class="qg-usdjpy-evolution__section-head">
        <div>
          <h3>因果 bar/tick 回放</h3>
          <p>只用当时已存在的 RSI、时段、点差、新闻风险、冷却和守门状态；未来后验只评分，不触发。</p>
        </div>
        <strong>{{ barReplayStatus }}</strong>
      </div>
      <div class="qg-usdjpy-evolution__scenario-grid">
        <article>
          <span>当前规则</span>
          <strong>{{ causalMetric('entry', 0, 'sampleCount') }} 次</strong>
          <p>
            净值 {{ causalMetric('entry', 0, 'netR') }}R / 最大不利
            {{ causalMetric('entry', 0, 'maxAdverseR') }}R
          </p>
        </article>
        <article>
          <span>放宽 RSI 一档</span>
          <strong>{{ causalMetric('entry', 1, 'entryCountDelta') }} 次增量</strong>
          <p>
            净变化 {{ signedMetric(causalMetric('entry', 1, 'netRDelta')) }}R / 结论
            {{ conclusionZh(causalMetric('entry', 1, 'conclusion')) }}
          </p>
        </article>
        <article>
          <span>当前出场</span>
          <strong>{{ ratioMetric(causalMetric('exit', 0, 'profitCaptureRatio')) }}</strong>
          <p>利润捕获率 / 样本 {{ causalMetric('exit', 0, 'sampleCount') }} 次</p>
        </article>
        <article>
          <span>盈利多拿一段</span>
          <strong>{{ ratioMetric(causalMetric('exit', 1, 'profitCaptureRatio')) }}</strong>
          <p>
            净变化 {{ signedMetric(causalMetric('exit', 1, 'netRDelta')) }}R / 结论
            {{ conclusionZh(causalMetric('exit', 1, 'conclusion')) }}
          </p>
        </article>
      </div>
      <p class="qg-usdjpy-evolution__note">
        {{ barReplay?.causalReplay?.explanationZh || '后验窗口只能用于评分，不能决定当时是否入场。' }}
      </p>
    </section>

    <section v-if="newsGateReplay" class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--news">
      <div class="qg-usdjpy-evolution__section-head">
        <div>
          <h3>新闻门禁回放</h3>
          <p>比较普通新闻硬挡、软降仓、只挡高冲击和影子忽略新闻；不自动修改实盘 preset。</p>
        </div>
        <strong>{{ newsGateReplay.recommendationZh || '默认 SOFT' }}</strong>
      </div>
      <div class="qg-usdjpy-evolution__mini-list">
        <article v-for="variant in newsGateVariants" :key="variant.variant">
          <span>{{ variant.labelZh || variant.variant }}</span>
          <strong>{{ variant.recommendation || '待评估' }}</strong>
          <p>
            净 R 变化 {{ signedMetric(variant.netRDelta ?? 0) }}；最大不利变化
            {{ signedMetric(variant.maxAdverseRDelta ?? 0) }}
          </p>
        </article>
      </div>
    </section>

    <section class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--evidence-os">
      <div class="qg-usdjpy-evolution__section-head">
        <div>
          <h3>影子 / 历史反馈、经验记忆与下一代遗传进化</h3>
          <p>
            当前影子评估与已有历史反馈只用于审计和经验记忆；生产 EA 不会生成新的 broker 成交、拒单或改单事件。
          </p>
        </div>
        <strong>{{ executionGateStatusZh }}</strong>
      </div>
      <div class="qg-usdjpy-evolution__scenario-grid">
        <article>
          <span>三方一致性</span>
          <strong>{{ deepParityStatusZh }}</strong>
          <p>{{ deepParityDisplayReason }}</p>
        </article>
        <article>
          <span>策略契约</span>
          <strong>{{ deepStrategySummary }}</strong>
          <p>{{ deepStrategyGateSummary }}</p>
        </article>
        <article>
          <span>Python 回放</span>
          <strong>{{ deepReplaySummary }}</strong>
          <p>{{ deepReplayGateSummary }}</p>
        </article>
        <article>
          <span>EA 输出</span>
          <strong>{{ deepEaSummary }}</strong>
          <p>{{ deepEaGateSummary }}</p>
        </article>
        <article>
          <span>反馈可信度门</span>
          <strong>{{
            executionPromotionAllowed ? '可用于 Shadow 研究晋级' : '保持 Shadow / 待补证据'
          }}</strong>
          <p>{{ executionGate.reasonZh || '等待 Shadow 评估或历史兼容反馈。' }}</p>
        </article>
        <article>
          <span>代理动作</span>
          <strong>{{ executionAgentActionZh }}</strong>
          <p>{{ executionFeedback.nextActionZh || '等待 Shadow 评估或历史只读反馈后再评估。' }}</p>
        </article>
        <article>
          <span>历史 / 模拟质量</span>
          <strong>{{ executionMetrics.feedbackQuality || 'MISSING' }}</strong>
          <p>
            拒单 {{ executionMetrics.rejectCount || 0 }} / 滑点
            {{ executionMetrics.avgAbsSlippagePips || 0 }} pips / 延迟
            {{ executionMetrics.avgLatencyMs || 0 }} ms
          </p>
        </article>
        <article>
          <span>经验 → 遗传进化</span>
          <strong>{{ caseMemoryToGA.queuedHintCount || gaSeedHints.length || 0 }} 条种子线索</strong>
          <p>{{ caseMemoryToGA.nextActionZh || '等待经验记忆生成下一代策略契约线索。' }}</p>
        </article>
      </div>
      <div
        v-if="deepParityHardMismatches.length || deepParityMissingOptional.length"
        class="qg-usdjpy-evolution__mini-list"
      >
        <article v-for="item in deepParityHardMismatches.slice(0, 6)" :key="`parity-hard-${item}`">
          <span>Parity 硬差异</span>
          <strong>{{ item }}</strong>
          <p>该差异会阻断策略晋级，直到策略契约、Python 回放和 EA 输出重新一致。</p>
        </article>
        <article v-for="item in deepParityMissingOptional.slice(0, 6)" :key="`parity-missing-${item}`">
          <span>Parity 缺字段</span>
          <strong>{{ item }}</strong>
          <p>这是审计提醒，不会单独阻断；建议后续让 EA 或 replay 输出补齐。</p>
        </article>
      </div>
      <div v-if="executionBlockers.length || executionWarnings.length" class="qg-usdjpy-evolution__mini-list">
        <article v-for="item in executionBlockers.slice(0, 4)" :key="`block-${item.code}`">
          <span>反馈阻断</span>
          <strong>{{ item.code }}</strong>
          <p>{{ item.reasonZh }}</p>
        </article>
        <article v-for="item in executionWarnings.slice(0, 4)" :key="`warn-${item.code}`">
          <span>反馈警告</span>
          <strong>{{ item.code }}</strong>
          <p>{{ item.reasonZh }}</p>
        </article>
      </div>
      <div v-if="gaSeedHints.length" class="qg-usdjpy-evolution__table-wrap">
        <table class="qg-usdjpy-evolution__table qg-usdjpy-evolution__table--compact">
          <thead>
            <tr>
              <th>经验</th>
              <th>类型</th>
              <th>优先级</th>
              <th>下一代变异提示</th>
              <th>原因</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in gaSeedHints.slice(0, 10)" :key="item.caseId || item.mutationHint">
              <td>{{ item.caseId || 'CASE_MEMORY' }}</td>
              <td>{{ item.caseType || 'UNKNOWN' }}</td>
              <td>{{ item.priority || 'MEDIUM' }}</td>
              <td>{{ mutationHintZh(item.mutationHint) }}</td>
              <td>{{ item.reasonZh || '进入下一代遗传进化模拟候选。' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="qg-usdjpy-evolution__note">
        这里不下单、不改 preset；它只判断影子/历史证据是否支持研究晋级，以及下一代 GA
        该优先修哪类观察或策略问题。当前始终保持 executionLaneExists=false。
      </p>
    </section>

    <details
      class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--deep-evidence"
      @toggle="revealDeepEvidencePanels"
    >
      <summary>深度证据面板</summary>
      <template v-if="deepEvidencePanelsVisible">
        <USDJPYCaseMemoryPanel
          :payload="caseMemoryCandidatePayload"
          :fallback-case-memory="caseMemory"
          :core-evidence="coreRuntimeEvidence"
          :loading="loading"
          @build="runCaseMemoryBuild"
        />

        <USDJPYGAFactoryPanel
          :payload="gaFactoryPayload"
          :ga-status="gaStatus"
          :intent-plan="strategyIntentPlanPayload"
          :loading="loading"
          @build="runGAFactoryBuild"
          @build-intent="runStrategyFactoryIntentPlan"
        />

        <TelegramGatewayOpsPanel
          :payload="telegramGatewayOpsPayload"
          :fallback="telegramGateway"
          :loading="loading"
          @collect="runTelegramGatewayOpsCollect"
        />

        <ExecutionFeedbackCoverageCard />
      </template>
    </details>

    <section class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--ga">
      <div class="qg-usdjpy-evolution__section-head">
        <div>
          <h3>遗传进化全过程审计</h3>
          <p>
            策略契约种子、代际、适应度、阻断、精英和下一代路径全部可追踪；只进入 MT5 模拟、
            测试器和实时行情只读干跑。
          </p>
        </div>
        <strong>{{ statusZh(gaStatus.status, '等待第一代') }}</strong>
      </div>
      <div class="qg-usdjpy-evolution__scenario-grid">
        <article>
          <span>当前代数</span>
          <strong>第 {{ gaStatus.currentGeneration || 0 }} 代</strong>
          <p>种群 {{ gaStatus.populationSize || 0 }} / 精英 {{ gaStatus.eliteCount || 0 }}</p>
        </article>
        <article>
          <span>最佳适应度</span>
          <strong>{{ gaStatus.bestFitness ?? 0 }}</strong>
          <p>{{ gaStatus.bestSeedId || '等待种子评分' }}</p>
        </article>
        <article>
          <span>阻断候选</span>
          <strong>{{ gaStatus.blockedCandidates || 0 }}</strong>
          <p>{{ topGABlocker?.reasonZh || '暂无阻断摘要' }}</p>
        </article>
        <article>
          <span>下一步</span>
          <strong>{{ gaStatus.nextAction ? '已规划' : '等待运行' }}</strong>
          <p>{{ gaStatus.nextAction || '点击“运行遗传进化”生成全过程审计。' }}</p>
        </article>
      </div>
      <div v-if="gaPathItems.length" class="qg-usdjpy-evolution__ga-timeline">
        <article v-for="item in gaPathItems.slice(-8)" :key="item.generationId || item.generation">
          <span>第 {{ item.generation }} 代</span>
          <strong>{{ item.bestFitness }}</strong>
          <p>平均 {{ item.avgFitness }} / 精英 {{ item.eliteCount }} / 阻断 {{ item.blockedCount }}</p>
        </article>
      </div>
      <div v-if="gaCandidateItems.length" class="qg-usdjpy-evolution__table-wrap">
        <table class="qg-usdjpy-evolution__table">
          <thead>
            <tr>
              <th>种子</th>
              <th>策略族</th>
              <th>来源</th>
              <th>适应度</th>
              <th>PF</th>
              <th>胜率</th>
              <th>最大回撤</th>
              <th>Sharpe / Sortino</th>
              <th>交易数</th>
              <th>历史样本</th>
              <th>Parity / 影子与历史反馈</th>
              <th>Rank</th>
              <th>阶段</th>
              <th>阻断原因</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in gaCandidateItems.slice(0, 12)"
              :key="item.seedId"
              :class="`qg-usdjpy-evolution__candidate--${String(item.status || '').toLowerCase()}`"
              @click="selectGASeed(item)"
            >
              <td>{{ item.seedId }}</td>
              <td>{{ item.strategyFamily }} / {{ directionZh(item.direction) }}</td>
              <td>{{ item.source }}</td>
              <td>{{ item.fitness }}</td>
              <td>{{ gaBacktestMetric(item, 'profitFactor') }}</td>
              <td>{{ gaBacktestWinRate(item) }}</td>
              <td>{{ gaBacktestDrawdown(item) }}</td>
              <td>{{ gaBacktestSharpeSortino(item) }}</td>
              <td>{{ gaBacktestMetric(item, 'tradeCount', 0) }}</td>
              <td>{{ gaHistoryProductionStatus(item) }}</td>
              <td>{{ gaEvidenceGateSummary(item) }}</td>
              <td>{{ item.rank }}</td>
              <td>{{ statusZh(item.status) }}</td>
              <td>{{ item.blockerZh || '通过' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="selectedGASeed" class="qg-usdjpy-evolution__seed-detail">
        <div
          v-if="selectedGASeedLoading || selectedGASeedError"
          class="qg-usdjpy-evolution__seed-detail-state"
        >
          <span>{{ selectedGASeedLoading ? '正在加载候选完整审计' : '候选审计加载失败' }}</span>
          <p>
            {{ selectedGASeedError || '正在读取权益曲线、血统、变异/交叉来源与完整证据链。' }}
          </p>
        </div>
        <div>
          <span>候选完整审计</span>
          <strong>{{ selectedGASeed.seedId }} / {{ selectedGASeed.strategyId }}</strong>
          <p>{{ gaSourceTrace(selectedGASeed).reasonZh || '等待来源审计。' }}</p>
        </div>
        <div>
          <span>适应度分解</span>
          <p>
            净R {{ selectedGASeed.fitnessBreakdown?.netR ?? 0 }}； 最大不利R
            {{ selectedGASeed.fitnessBreakdown?.maxAdverseR ?? 0 }}； 样本
            {{ selectedGASeed.fitnessBreakdown?.sampleCount ?? 0 }}； 过拟合惩罚
            {{ selectedGASeed.fitnessBreakdown?.overfitPenalty ?? 0 }}
          </p>
        </div>
        <div class="qg-usdjpy-evolution__seed-audit-grid">
          <article class="qg-usdjpy-evolution__equity-card">
            <span>权益曲线</span>
            <strong>{{ gaBacktestMetric(selectedGASeed, 'netR') }}R</strong>
            <svg
              v-if="gaEquityPolyline(selectedGASeed)"
              viewBox="0 0 240 72"
              role="img"
              aria-label="候选权益曲线"
            >
              <polyline :points="gaEquityPolyline(selectedGASeed)" />
            </svg>
            <p v-else>等待候选专属回测权益曲线。</p>
            <p>
              点数
              {{
                gaBacktestAudit(selectedGASeed).equityPointCount ||
                gaEquityPoints(selectedGASeed).length ||
                0
              }}； 交易
              {{
                gaBacktestAudit(selectedGASeed).tradeCount ||
                gaBacktestMetric(selectedGASeed, 'tradeCount', 0)
              }}
            </p>
          </article>
          <article>
            <span>父代路径</span>
            <strong>{{ gaLineageSummary(selectedGASeed) }}</strong>
            <p>{{ gaLineageAudit(selectedGASeed).reasonZh || '等待血统审计。' }}</p>
            <p>{{ gaLineageParentsText(selectedGASeed) }}</p>
          </article>
          <article>
            <span>变异 / 交叉来源</span>
            <strong>{{ gaSourceTrace(selectedGASeed).source || selectedGASeed.source || 'LLM_SEED' }}</strong>
            <p>
              {{ mutationHintZh(gaSourceTrace(selectedGASeed).mutationHint) }}； 经验
              {{ gaSourceTrace(selectedGASeed).caseId || '—' }}
            </p>
          </article>
          <article>
            <span>生产历史样本</span>
            <strong>{{ gaHistoryProductionStatus(selectedGASeed) }}</strong>
            <p>{{ gaHistoryProductionReason(selectedGASeed) }}</p>
          </article>
        </div>
        <div v-if="gaLineagePathNodes(selectedGASeed).length" class="qg-usdjpy-evolution__lineage-path">
          <div class="qg-usdjpy-evolution__lineage-path-head">
            <div>
              <span>主血统时间线</span>
              <strong>{{ gaLineagePathSummary(selectedGASeed) }}</strong>
              <p>
                {{ gaLineagePath(selectedGASeed).reasonZh || '按代际展示当前精英主血统。' }}
                黄色点为精英路径命中，蓝色点为当前选中候选。
              </p>
            </div>
          </div>
          <div class="qg-usdjpy-evolution__lineage-path-track">
            <article
              v-for="node in gaLineagePathNodes(selectedGASeed)"
              :key="`${node.order}-${node.seedId}`"
              class="qg-usdjpy-evolution__lineage-path-node"
              :class="{
                'qg-usdjpy-evolution__lineage-path-node--elite': node.onElitePath,
                'qg-usdjpy-evolution__lineage-path-node--selected': node.selected,
              }"
            >
              <span>{{ gaLineagePathNodeTitle(node) }}</span>
              <strong>{{ node.seedId }}</strong>
              <p>{{ gaLineagePathNodeMeta(node) }}</p>
            </article>
          </div>
        </div>
        <div v-if="gaLineageTreeNodes(selectedGASeed).length" class="qg-usdjpy-evolution__lineage-tree">
          <div class="qg-usdjpy-evolution__lineage-tree-head">
            <div>
              <span>进化树</span>
              <strong>{{ gaLineageTreeSummary(selectedGASeed) }}</strong>
              <p>
                精英路径高亮；默认折叠远端旁支。
                {{ gaLineageTree(selectedGASeed).reasonZh || '展示父代、当前候选和子代的变异 / 交叉路径。' }}
              </p>
            </div>
            <button
              v-if="gaLineageTreeHiddenCount(selectedGASeed)"
              type="button"
              class="qg-usdjpy-evolution__lineage-toggle"
              @click="lineageTreeExpanded = !lineageTreeExpanded"
            >
              {{
                lineageTreeExpanded
                  ? '折叠旁支'
                  : `展开全部血统（隐藏 ${gaLineageTreeHiddenCount(selectedGASeed)}）`
              }}
            </button>
          </div>
          <div class="qg-usdjpy-evolution__lineage-levels">
            <article
              v-for="level in gaLineageTreeLevels(selectedGASeed)"
              :key="level.depth"
              class="qg-usdjpy-evolution__lineage-level"
            >
              <span>{{ gaLineageLevelTitle(level.depth) }}</span>
              <div
                v-for="node in level.nodes"
                :key="node.seedId"
                class="qg-usdjpy-evolution__lineage-node"
                :class="{
                  'qg-usdjpy-evolution__lineage-node--selected': node.selected,
                  'qg-usdjpy-evolution__lineage-node--external': node.external,
                  'qg-usdjpy-evolution__lineage-node--elite-path': node.onElitePath,
                  'qg-usdjpy-evolution__lineage-node--elite': node.eliteSelected,
                }"
              >
                <strong>{{ node.seedId }}</strong>
                <p>{{ gaLineageNodeMeta(node) }}</p>
                <em>{{ statusZh(node.status, node.external ? '外部线索' : '等待评分') }}</em>
              </div>
            </article>
          </div>
          <div v-if="gaLineageTreeEdges(selectedGASeed).length" class="qg-usdjpy-evolution__lineage-edges">
            <span>变异 / 交叉路径</span>
            <article
              v-for="edge in gaLineageTreeEdges(selectedGASeed)"
              :key="`${edge.from}-${edge.to}-${edge.type}`"
              :class="{ 'qg-usdjpy-evolution__lineage-edge--elite-path': edge.onElitePath }"
            >
              <strong>{{ edge.from }} → {{ edge.to }}</strong>
              <p>{{ lineageEdgeTypeZh(edge.type) }}；{{ edge.reasonZh || '遗传进化血统关联。' }}</p>
            </article>
          </div>
        </div>
        <div class="qg-usdjpy-evolution__seed-metrics">
          <article>
            <span>策略契约回测证据</span>
            <strong>{{ gaSeedBacktestStatus(selectedGASeed) }}</strong>
            <p>
              PF {{ gaBacktestMetric(selectedGASeed, 'profitFactor') }} / 胜率
              {{ gaBacktestWinRate(selectedGASeed) }} / 交易
              {{ gaBacktestMetric(selectedGASeed, 'tradeCount', 0) }}
            </p>
          </article>
          <article>
            <span>收益与回撤</span>
            <strong>{{ gaBacktestMetric(selectedGASeed, 'netR') }}R</strong>
            <p>
              最大回撤 {{ gaBacktestDrawdown(selectedGASeed) }}；最大不利
              {{ metricText(selectedGASeed.fitnessBreakdown?.maxAdverseR, 'R') }}
            </p>
          </article>
          <article>
            <span>稳定性</span>
            <strong>{{ gaBacktestSharpeSortino(selectedGASeed) }}</strong>
            <p>
              PF 奖励 {{ metricText(selectedGASeed.fitnessBreakdown?.profitFactorBonus) }}；胜率奖励
              {{ metricText(selectedGASeed.fitnessBreakdown?.winRateBonus) }}
            </p>
          </article>
          <article>
            <span>晋级证据</span>
            <strong>{{ gaEvidenceGateSummary(selectedGASeed) }}</strong>
            <p>
              一致性 {{ gaSeedParityStatus(selectedGASeed) }}；影子 / 历史反馈
              {{ gaSeedExecutionStatus(selectedGASeed) }}；经验惩罚
              {{ metricText(selectedGASeed.fitnessBreakdown?.caseMemory?.penalty) }}
            </p>
          </article>
        </div>
        <div
          v-if="gaWalkForwardSegments(selectedGASeed).length"
          class="qg-usdjpy-evolution__seed-metrics qg-usdjpy-evolution__seed-metrics--walk-forward"
        >
          <article>
            <span>单候选前向验证</span>
            <strong>{{ gaWalkForwardStatus(selectedGASeed) }}</strong>
            <p>
              稳定分 {{ metricText(gaWalkForwardSummary(selectedGASeed).stabilityScore) }}； 样本
              {{ gaWalkForwardSummary(selectedGASeed).sampleCount || 0 }}； 惩罚
              {{ metricText(selectedGASeed.fitnessBreakdown?.walkForwardPenalty) }}
            </p>
          </article>
          <article v-for="segment in gaWalkForwardSegments(selectedGASeed)" :key="segment.segment">
            <span>{{ gaWalkForwardSegmentTitle(segment) }}</span>
            <strong>{{ metricText(segment.netR, 'R') }}</strong>
            <p>
              PF {{ metricText(segment.profitFactor) }} / 胜率 {{ percentText(segment.winRate) }} / DD
              {{ metricText(segment.maxDrawdownR, 'R') }} / 交易 {{ segment.tradeCount || 0 }}
            </p>
            <p>
              Parity {{ segment.parityStatus || '等待' }}；执行惩罚
              {{ metricText(segment.executionFeedbackPenalty) }}
            </p>
          </article>
        </div>
        <div class="qg-usdjpy-evolution__evidence-chain">
          <span>完整证据链</span>
          <article v-for="item in gaEvidenceChain(selectedGASeed)" :key="item.step">
            <strong>{{ item.step }}</strong>
            <em>{{ item.status }}</em>
            <p>{{ item.reasonZh }}</p>
          </article>
        </div>
        <div v-if="gaAuditTrades(selectedGASeed).length" class="qg-usdjpy-evolution__table-wrap">
          <table class="qg-usdjpy-evolution__table qg-usdjpy-evolution__table--compact">
            <thead>
              <tr>
                <th>回测交易</th>
                <th>方向</th>
                <th>入场</th>
                <th>出场</th>
                <th>profitR</th>
                <th>MFE / MAE</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trade in gaAuditTrades(selectedGASeed).slice(-8)" :key="trade.tradeId">
                <td>{{ trade.tradeId }}</td>
                <td>{{ directionZh(trade.direction) }}</td>
                <td>{{ trade.entryTime }}</td>
                <td>{{ trade.exitReason || trade.exitTime }}</td>
                <td>{{ metricText(trade.profitR, 'R') }}</td>
                <td>{{ metricText(trade.mfeR, 'R') }} / {{ metricText(trade.maeR, 'R') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre>{{ strategyJsonPreview(selectedGASeed.strategyJson) }}</pre>
      </div>
      <p class="qg-usdjpy-evolution__note">
        遗传进化永久保持 Shadow / tester，不能创建 execution lane、修改 preset 或恢复 broker mutation，
        也不能绕过新闻、点差、运行新鲜度和快通道证据门禁。
      </p>
    </section>

    <section
      v-if="strategyBacktestReport"
      class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--strategy-backtest"
    >
      <div class="qg-usdjpy-evolution__section-head">
        <div>
          <h3>策略契约高保真回测</h3>
          <p>统一策略契约读取 USDJPY SQLite K线，输出交易、权益曲线和遗传进化可读适应度证据。</p>
        </div>
        <strong>{{ evidenceQualityZh(strategyBacktestReport.evidenceQuality) }}</strong>
      </div>
      <div class="qg-usdjpy-evolution__scenario-grid">
        <article>
          <span>回测策略</span>
          <strong
            >{{ strategyBacktestReport.strategyFamily || '证据不可用' }} /
            {{ directionZh(strategyBacktestReport.direction) }}</strong
          >
          <p class="qg-usdjpy-evolution__strategy-id">
            {{ strategyBacktestReport.strategyId || '策略契约种子' }}
          </p>
        </article>
        <article>
          <span>净收益</span>
          <strong>{{ strategyBacktestMetrics.netR ?? 0 }}R</strong>
          <p>
            {{ strategyBacktestMetrics.netPips ?? 0 }} pips / {{ strategyBacktestMetrics.tradeCount ?? 0 }} 笔
          </p>
        </article>
        <article>
          <span>稳定性</span>
          <strong>{{ strategyBacktestMetrics.profitFactor ?? 0 }} PF</strong>
          <p>
            胜率 {{ strategyBacktestMetrics.winRate ?? 0 }}% / 最大回撤
            {{ strategyBacktestMetrics.maxDrawdownR ?? 0 }}R
          </p>
        </article>
        <article>
          <span>风险捕获</span>
          <strong>{{ strategyBacktestMetrics.profitCaptureRatio ?? 0 }}</strong>
          <p>
            Sharpe {{ strategyBacktestMetrics.sharpe ?? 0 }} / Sortino
            {{ strategyBacktestMetrics.sortino ?? 0 }}
          </p>
        </article>
        <article>
          <span>Runner 覆盖</span>
          <strong>{{ backtestCoverageZh }}</strong>
          <p>
            主周期 {{ strategyBacktestEngine.primaryTimeframe || strategyBacktestReport.timeframe || 'H1' }} /
            信号 {{ strategyBacktestEngine.signalCount ?? 0 }}
          </p>
        </article>
        <article>
          <span>交易成本</span>
          <strong>{{ backtestCost.roundTurnPips ?? 0 }} pips</strong>
          <p>
            点差 {{ backtestCost.spreadPips ?? 0 }} / 滑点 {{ backtestCost.slippagePips ?? 0 }} / 手续
            {{ backtestCost.commissionPips ?? 0 }}
          </p>
        </article>
        <article>
          <span>真实 K线入库</span>
          <strong>{{ h1BarCount }} 根 H1</strong>
          <p>
            M15 {{ klineCounts.M15 || 0 }} / H4 {{ klineCounts.H4 || 0 }} / D1
            {{ klineCounts.D1 || 0 }}；只同步 USDJPY。
          </p>
        </article>
        <article>
          <span>遗传进化历史样本</span>
          <strong>{{ historyProductionStatusZh }}</strong>
          <p>{{ historyProductionSummaryZh }}</p>
        </article>
      </div>
      <p class="qg-usdjpy-evolution__note">
        本模块只写本地回测库、JSON 和 CSV；已覆盖 USDJPY 模拟策略族并向遗传进化提供逐候选
        适应度证据；不会下单、不会平仓、不会撤单、不会修改 preset。
      </p>
    </section>

    <section
      v-if="scenarioItems.length"
      class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--scenarios"
    >
      <h3>回放候选对比</h3>
      <div class="qg-usdjpy-evolution__scenario-grid">
        <article v-for="item in scenarioItems" :key="item.scenario">
          <span>{{ item.labelZh || item.scenario }}</span>
          <strong>{{ formatScenarioDelta(item) }}</strong>
          <p>
            样本 {{ item.sampleCount || 0 }} /
            {{ item.verdict === 'shadow_only' ? '只进入影子验证' : scenarioVerdictZh(item.verdict) }}
          </p>
        </article>
      </div>
      <p class="qg-usdjpy-evolution__note">
        {{ unitPolicy.note || '回放主口径使用 R 倍数，pips 辅助；USC 只作为账面参考。' }}
      </p>
    </section>

    <section v-if="walkForward" class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--walk-forward">
      <div class="qg-usdjpy-evolution__section-head">
        <div>
          <h3>前向验证稳定性筛选</h3>
          <p>按 train / validation / forward 三段筛掉不稳定候选；后验数据只评分，不能反推当时入场。</p>
        </div>
        <strong>{{ walkForward.statusZh || walkForward.status || '等待筛选' }}</strong>
      </div>
      <div class="qg-usdjpy-evolution__scenario-grid">
        <article v-for="item in walkForwardCandidates" :key="item.variant">
          <span>{{ item.labelZh || item.variant }}</span>
          <strong>{{ conclusionZh(item.conclusion) }}</strong>
          <p>
            总净变化 {{ signedMetric(item.summary?.netRDelta ?? '—') }}R / forward
            {{ signedMetric(item.summary?.forwardNetRDelta ?? '—') }}R
          </p>
        </article>
      </div>
    </section>

    <section
      v-if="strategyContractPayload"
      class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--strategy-contract"
    >
      <div class="qg-usdjpy-evolution__section-head">
        <div>
          <h3>Strategy JSON → EA 契约</h3>
          <p>策略契约 → EA 只读契约候选，在模拟、测试器和 MT5 实时行情干跑中按同一契约评估。</p>
        </div>
        <strong>{{ strategyContractStatusZh }}</strong>
      </div>
      <article>
        <strong>{{ strategyContractStrategy.strategyFamily || '策略契约' }}</strong>
        <span
          >{{ strategyContractStrategy.direction || '—' }} /
          {{ strategyContractStrategy.entryMode || '—' }}</span
        >
        <p>
          Seed：{{ strategyContractSeed }}；Fingerprint：{{ strategyContractFingerprint }}；Contract：
          {{ strategyContractPayload?.contract?.contractMode || '—' }}
        </p>
        <p>
          EA 回执：{{ strategyContractEAStatusZh }}；{{
            strategyContractPayload?.eaStatus?.reasonZh ||
            strategyContractPayload?.contract?.ea?.reasonZh ||
            '等待 EA 加载只读契约。'
          }}
        </p>
        <p>
          EA 影子评估：{{ strategyContractShadowEvalStatusZh }}；{{
            strategyContractPayload?.eaShadowEvaluation?.reasonZh || '等待 EA 写入策略契约影子评估账本。'
          }}
        </p>
        <p>
          Ledger：{{ strategyContractShadowEvalRows }} 条最近评估；would-enter
          {{ strategyContractPayload?.eaShadowEvaluation?.wouldEnter ? '已出现' : '未出现' }}。
        </p>
      </article>
    </section>

    <section
      v-if="candidateItems.length"
      class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--candidates"
    >
      <h3>下一轮 tester-only 参数候选</h3>
      <article v-for="item in candidateItems.slice(0, 4)" :key="item.param">
        <strong>{{ item.param }}</strong>
        <span>{{ item.current }} → {{ item.proposed }}</span>
        <p>{{ item.reason }}</p>
        <p>预期影响：{{ item.expectedImpact || '等待回放补证' }}</p>
        <p>风险变化：{{ item.riskDelta || '未知，禁止直接改实盘' }}</p>
      </article>
    </section>
    <details
      class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--production"
      @toggle="revealProductionPanels"
    >
      <summary>生产证据验证</summary>
      <template v-if="productionPanelsVisible">
        <ProductionEvidenceValidationPanel />
        <GAMultiGenerationStabilityCard />
      </template>
    </details>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { buildCaseMemoryCandidates, fetchCaseMemoryStatus } from '../services/caseMemoryApi.js';
import { fetchProductionEvidenceStatus } from '../services/productionEvidenceApi.js';
import {
  buildStrategyFactoryIntentPlan,
  buildStrategyGaFactory,
  fetchStrategyFactoryIntentPlan,
  fetchStrategyGaFactoryStatus,
} from '../services/strategyGaFactoryApi.js';
import {
  collectTelegramGatewayOps,
  fetchTelegramGatewayOpsStatus,
} from '../services/telegramGatewayOpsApi.js';
import {
  fetchUSDJPYAutonomousAgent,
  fetchUSDJPYAutonomousLanes,
  fetchUSDJPYAutonomousLifecycle,
  fetchUSDJPYAgentDailyReview,
  fetchUSDJPYAgentDailyTodo,
  fetchUSDJPYBarReplayStatus,
  fetchUSDJPYDailyAutopilotV2,
  fetchUSDJPYEaReproducibility,
  fetchUSDJPYEvidenceOSStatus,
  fetchUSDJPYEvolutionStatus,
  fetchUSDJPYGABlockers,
  fetchUSDJPYGACandidate,
  fetchUSDJPYGACandidates,
  fetchUSDJPYGAEvolutionPath,
  fetchUSDJPYGAStatus,
  fetchUSDJPYMt5ShadowLane,
  fetchUSDJPYStrategyBacktestProductionStatus,
  fetchUSDJPYStrategyBacktestStatus,
  fetchUSDJPYStrategyContractStatus,
  fetchUSDJPYTelegramGatewayStatus,
  buildUSDJPYStrategyContract,
  fetchUSDJPYWalkForwardStatus,
  runUSDJPYAutonomousAgent,
  runUSDJPYBarReplayBuild,
  runUSDJPYAgentDailyReview,
  runUSDJPYAgentDailyTodo,
  runUSDJPYDailyAutopilotV2,
  runUSDJPYEvidenceOS,
  runUSDJPYEvolutionBuild,
  runUSDJPYGAGeneration,
  runUSDJPYConfigProposal,
  runUSDJPYParamTuning,
  runUSDJPYReplayReport,
  runUSDJPYStrategyBacktest,
  runUSDJPYWalkForwardBuild,
  syncUSDJPYStrategyBacktestKlines,
} from '../services/usdjpyStrategyLabApi.js';

const ExecutionFeedbackCoverageCard = defineAsyncComponent(
  () => import('./ExecutionFeedbackCoverageCard.vue'),
);
const ProductionEvidenceValidationPanel = defineAsyncComponent(
  () => import('./ProductionEvidenceValidationPanel.vue'),
);
const TelegramGatewayOpsPanel = defineAsyncComponent(() => import('./TelegramGatewayOpsPanel.vue'));
const USDJPYCaseMemoryPanel = defineAsyncComponent(() => import('./USDJPYCaseMemoryPanel.vue'));
const USDJPYGAFactoryPanel = defineAsyncComponent(() => import('./USDJPYGAFactoryPanel.vue'));
const GAMultiGenerationStabilityCard = defineAsyncComponent(
  () => import('./GAMultiGenerationStabilityCard.vue'),
);

const payload = shallowRef(null);
const barReplay = shallowRef(null);
const walkForward = shallowRef(null);
const autonomousAgent = shallowRef(null);
const lifecyclePayload = shallowRef(null);
const lanesPayload = shallowRef(null);
const mt5ShadowPayload = shallowRef(null);
const eaReproPayload = shallowRef(null);
const dailyAutopilot = shallowRef(null);
const agentDailyTodo = shallowRef(null);
const agentDailyReview = shallowRef(null);
const gaPayload = shallowRef(null);
const gaCandidatesPayload = shallowRef(null);
const gaPathPayload = shallowRef(null);
const gaBlockersPayload = shallowRef(null);
const gaFactoryPayload = shallowRef(null);
const strategyIntentPlanPayload = shallowRef(null);
const strategyBacktestPayload = shallowRef(null);
const historyProductionPayload = shallowRef(null);
const productionEvidencePayload = shallowRef(null);
const evidenceOSPayload = shallowRef(null);
const caseMemoryCandidatePayload = shallowRef(null);
const telegramGatewayPayload = shallowRef(null);
const telegramGatewayOpsPayload = shallowRef(null);
const strategyContractPayload = shallowRef(null);
const selectedGASeed = shallowRef(null);
const selectedGASeedLoading = ref(false);
const selectedGASeedError = ref('');
const gaSeedSelectionPinned = ref(false);
const lineageTreeExpanded = ref(false);
const loading = ref(false);
const error = ref('');
const actionStatus = ref(null);
const deepEvidencePanelsVisible = ref(false);
const productionPanelsVisible = ref(false);
let loadController = null;
let loadRunId = 0;

const dataset = computed(() => payload.value?.dataset || {});
const replay = computed(() => payload.value?.replay || {});
const tuning = computed(() => payload.value?.tuning || {});
const proposal = computed(() => payload.value?.proposal || {});
const datasetSummary = computed(() => dataset.value?.summary || {});
const replaySummary = computed(() => replay.value?.summary || {});
const tuningSummary = computed(() => tuning.value?.summary || {});
const candidateItems = computed(() =>
  Array.isArray(tuning.value?.candidates) ? tuning.value.candidates : [],
);
const scenarioItems = computed(() =>
  Array.isArray(replay.value?.scenarioComparisons) ? replay.value.scenarioComparisons : [],
);
const unitPolicy = computed(() => replay.value?.unitPolicy || {});
const replayStatus = computed(() => replay.value?.statusZh || statusZh(replay.value?.status, '等待回放'));
const barReplayStatus = computed(
  () => barReplay.value?.statusZh || statusZh(barReplay.value?.status, '等待因果回放'),
);
const walkForwardCandidates = computed(() =>
  Array.isArray(walkForward.value?.candidates) ? walkForward.value.candidates : [],
);
const agentPatch = computed(() => autonomousAgent.value?.currentPatch || {});
const agentLimits = computed(() => agentPatch.value?.limits || {});
const patchWritable = computed(() => Boolean(autonomousAgent.value?.patchWritable));
const autonomousLifecycle = computed(
  () => lifecyclePayload.value || autonomousAgent.value?.autonomousLifecycle || {},
);
const centAccount = computed(
  () => autonomousAgent.value?.centAccount || autonomousLifecycle.value?.centAccount || {},
);
const lanes = computed(
  () => lanesPayload.value?.lanes || autonomousAgent.value?.lanes || autonomousLifecycle.value?.lanes || null,
);
const liveLane = computed(() => lanes.value?.live || {});
const mt5Shadow = computed(() => mt5ShadowPayload.value || lanes.value?.mt5Shadow || {});
const mt5ShadowSummary = computed(() => mt5Shadow.value?.summary || {});
const newsGate = computed(
  () => dailyAutopilot.value?.newsGate || payload.value?.policy?.newsGate || barReplay.value?.newsGate || {},
);
const newsGateReplay = computed(() => barReplay.value?.newsGateReplay || null);
const newsGateVariants = computed(() => {
  const variants = newsGateReplay.value?.variants || [];
  return Array.isArray(variants) ? variants : [];
});
const gaStatus = computed(() => gaPayload.value?.status || {});
const gaCandidateItems = computed(() => {
  const rows = gaCandidatesPayload.value?.candidates || [];
  return Array.isArray(rows) ? rows : [];
});
const gaPathItems = computed(() => {
  const rows = gaPathPayload.value?.generations || gaPayload.value?.evolutionPath?.generations || [];
  return Array.isArray(rows) ? rows : [];
});
const gaBlockerItems = computed(() => {
  const rows = gaBlockersPayload.value?.summary || gaPayload.value?.blockers?.summary || [];
  return Array.isArray(rows) ? rows : [];
});
const topGABlocker = computed(
  () => gaBlockerItems.value.find((item) => item?.blockerCode !== 'PASSED') || null,
);
const strategyBacktestReport = computed(
  () => strategyBacktestPayload.value?.latestReport || strategyBacktestPayload.value || null,
);
const historyProduction = computed(
  () =>
    historyProductionPayload.value ||
    strategyBacktestPayload.value?.historyProductionStatus ||
    strategyBacktestPayload.value?.qualityReport?.historyProductionStatus ||
    {},
);
const coreRuntimeEvidence = computed(
  () =>
    productionEvidencePayload.value?.report?.coreRuntimeEvidenceIntegrity ||
    productionEvidencePayload.value?.report?.coreRuntimeEvidenceSummary ||
    {},
);
const historyProductionStatusZh = computed(() => {
  const status = String(historyProduction.value?.status || 'MISSING').toUpperCase();
  if (status === 'PASS' && historyProduction.value?.historyTargetSatisfied) return '生产级 PASS';
  if (status === 'PASS') return 'PASS 待确认';
  if (status === 'WARN') return '生产告警';
  return '等待生产状态';
});
const historyProductionSummaryZh = computed(() => {
  const source = historyProduction.value?.source || {};
  const timeframes = historyProduction.value?.timeframes || {};
  const h1 = timeframes.H1 || {};
  const m1 = timeframes.M1 || {};
  const reason =
    historyProduction.value?.reasonZh ||
    (historyProduction.value?.historyTargetSatisfied
      ? '遗传进化正在使用生产级 USDJPY SQLite 历史样本评分。'
      : '遗传进化评分仍需等待 USDJPY 历史样本达到生产级通过。');
  const sourceZh = source.mql5ExportDir ? 'MQL5 CopyRates' : source.mt5Python ? 'MT5 Python' : '';
  const depth = h1.spanDays || m1.spanDays ? `；H1 ${h1.spanDays || 0} 天 / M1 ${m1.spanDays || 0} 天` : '';
  return `${reason}${sourceZh ? ` 来源 ${sourceZh}` : ''}${depth}`;
});
const strategyBacktestMetrics = computed(() => strategyBacktestReport.value?.metrics || {});
const strategyBacktestEngine = computed(() => strategyBacktestReport.value?.engine || {});
const strategyContract = computed(() => strategyContractPayload.value?.contract || {});
const strategyContractStrategy = computed(() => strategyContract.value?.strategy || {});
const strategyContractStatusZh = computed(() => {
  const status = strategyContractPayload.value?.status || 'WAITING_CONTRACT';
  if (status === 'CONTRACT_WRITTEN') return '契约已生成';
  if (status === 'CONTRACT_PREVIEW') return '契约预览';
  if (status === 'WAITING_CONTRACT_BUILD') return '等待契约';
  return statusZh(status, status);
});
const strategyContractEAStatusZh = computed(() => {
  const status = strategyContractPayload.value?.eaStatus?.status || 'WAITING_EA_ACK';
  if (status === 'SHADOW_CONTRACT_READY') return 'EA 已读取';
  if (status === 'WAITING_CONTRACT') return '等待契约文件';
  if (status === 'WAITING_EA_ACK') return '等待 EA 回执';
  if (status === 'SAFETY_REJECTED') return 'EA 已拒绝';
  return statusZh(status, status);
});
const strategyContractShadowEvalStatusZh = computed(() => {
  const status = strategyContractPayload.value?.eaShadowEvaluation?.status || 'WAITING_SHADOW_EVALUATION';
  if (status === 'SHADOW_WOULD_ENTER') return 'EA 看到影子机会';
  if (status === 'SHADOW_OBSERVE') return 'EA 正在影子观察';
  if (status === 'SHADOW_GUARD_BLOCKED') return 'EA 影子守门阻断';
  if (status === 'SHADOW_WAIT_INDICATORS') return '等待指标';
  if (status === 'UNSUPPORTED_STRATEGY_FAMILY_SHADOW_OBSERVE') return '策略族待适配';
  if (status === 'DIRECTION_SHADOW_ONLY_DEMOTED') return '方向仅影子';
  if (status === 'WAITING_SHADOW_EVALUATION') return '等待影子评估';
  return statusZh(status, status);
});
const strategyContractShadowEvalRows = computed(() =>
  Array.isArray(strategyContractPayload.value?.eaShadowEvaluationRecent)
    ? strategyContractPayload.value.eaShadowEvaluationRecent.length
    : 0,
);
const strategyContractSeed = computed(
  () =>
    strategyContract.value?.selectedSeedId || strategyContractStrategy.value?.seedId || '等待策略契约种子',
);
const strategyContractFingerprint = computed(() => {
  const value = strategyContract.value?.fingerprint || '—';
  return value === '—' ? value : `${String(value).slice(0, 10)}…`;
});
const backtestCost = computed(() => strategyBacktestEngine.value?.costModel || {});
const backtestCoverageZh = computed(() =>
  strategyBacktestEngine.value?.coverage === 'ALL_SUPPORTED_USDJPY_SHADOW_FAMILIES' ? '全策略族' : '等待覆盖',
);
const klineCounts = computed(() => strategyBacktestPayload.value?.barCounts || {});
const h1BarCount = computed(() => klineCounts.value.H1 || strategyBacktestReport.value?.barCount || 0);
const evidenceOS = computed(() => evidenceOSPayload.value || {});
const parityReport = computed(() => evidenceOS.value?.parity || {});
const deepParity = computed(() => parityReport.value?.deepParity || {});
const parityStatus = computed(() => parityReport.value?.status || '等待校验');
const deepParityDemotedSignal = computed(() => deepParity.value?.demotedOutOfScopeSignal || {});
const deepParityStatus = computed(() => deepParity.value?.status || parityStatus.value);
const deepParityStatusZh = computed(() =>
  deepParityDemotedSignal.value?.demoted ? '反向信号已降级' : parityStatusZh(deepParityStatus.value),
);
const deepParityDisplayReason = computed(
  () =>
    deepParityDemotedSignal.value?.reasonZh ||
    deepParity.value?.reasonZh ||
    parityReport.value?.reasonZh ||
    '等待策略契约、Python 回放和 EA 输出三方证据。',
);
const deepParityHardMismatches = computed(() => {
  const rows = deepParity.value?.hardMismatches || [];
  return Array.isArray(rows) ? rows : [];
});
const deepParityMissingOptional = computed(() => {
  const rows = deepParity.value?.missingOptionalFields || [];
  return Array.isArray(rows) ? rows : [];
});
const deepStrategyJson = computed(() => deepParity.value?.strategyJson || {});
const deepPythonReplay = computed(() => deepParity.value?.pythonReplay || {});
const deepMql5Ea = computed(() => deepParity.value?.mql5Ea || {});
const deepStrategySummary = computed(() => {
  const rsi = deepStrategyJson.value?.rsi || {};
  const family = deepStrategyJson.value?.strategyFamily || '等待策略';
  const direction = directionZh(deepStrategyJson.value?.direction);
  return `${family} / ${direction} / RSI ${metricText(rsi.period)}`;
});
const deepStrategyGateSummary = computed(() => {
  const gates = deepStrategyJson.value?.entryGateExpectations || {};
  const active = Object.entries(gates)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
    .join(' / ');
  return active ? `入场契约包含：${active}` : '等待策略契约入场门。';
});
const deepReplaySummary = computed(() =>
  deepPythonReplay.value?.posteriorMayAffectTrigger === false ? '因果回放通过' : '等待因果回放',
);
const deepReplayGateSummary = computed(() => {
  const gates = deepPythonReplay.value?.hardGatesNeverRelaxed || [];
  const gateText = Array.isArray(gates) && gates.length ? gates.join(' / ') : '等待 hard gate 列表';
  return `未来后验不参与触发；硬门禁：${gateText}`;
});
const deepEaSummary = computed(() => {
  const route = deepMql5Ea.value?.route || {};
  const rsi = deepMql5Ea.value?.rsi || {};
  return `${deepMql5Ea.value?.state || '等待 EA'} / ${route.timeframe || 'H1'} / RSI ${metricText(rsi.period)}`;
});
const deepEaGateSummary = computed(() => {
  if (deepParityDemotedSignal.value?.demoted) {
    return (
      deepParityDemotedSignal.value.reasonZh ||
      'EA 当前看到反向 RSI 信号，但该方向已降级；当前周期不作为晋级证据。'
    );
  }
  const guards = deepMql5Ea.value?.guards || {};
  return `session ${boolZh(guards.sessionOpen)} / spread ${boolZh(guards.spreadAllowed)} / newsBlocked ${boolZh(guards.newsBlocked)}`;
});
const executionFeedback = computed(() => evidenceOS.value?.executionFeedback || {});
const executionMetrics = computed(() => evidenceOS.value?.executionFeedback?.metrics || {});
const executionGate = computed(() => executionFeedback.value?.promotionGate || {});
const executionGateStatus = computed(() => executionGate.value?.status || 'WAITING_FEEDBACK');
const executionBlockers = computed(() => {
  const rows = executionGate.value?.blockers || [];
  return Array.isArray(rows) ? rows : [];
});
const executionWarnings = computed(() => {
  const rows = executionGate.value?.warnings || [];
  return Array.isArray(rows) ? rows : [];
});
const executionPromotionAllowed = computed(() => Boolean(executionGate.value?.promotionAllowed));
const executionGateStatusZh = computed(() => executionGateZh(executionGateStatus.value));
const executionAgentActionZh = computed(() => agentActionZh(executionFeedback.value?.agentAction?.action));
const caseMemory = computed(() => evidenceOS.value?.caseMemory || {});
const caseMemoryToGA = computed(() => caseMemory.value?.caseMemoryToGA || {});
const gaSeedHints = computed(() => {
  const rows = caseMemory.value?.gaSeedHints || [];
  return Array.isArray(rows) ? rows : [];
});
const telegramGateway = computed(
  () => telegramGatewayPayload.value || evidenceOS.value?.telegramGateway || {},
);
const eaRepro = computed(
  () =>
    eaReproPayload.value ||
    autonomousAgent.value?.eaReproducibility ||
    autonomousLifecycle.value?.eaReproducibility ||
    {},
);
const rollbackBlockers = computed(() => {
  const rollback = agentPatch.value?.rollback || {};
  return Array.isArray(rollback.hardBlockers) ? rollback.hardBlockers : [];
});
const dailyTodoItems = computed(() => {
  const items = agentDailyTodo.value?.items || dailyAutopilot.value?.dailyTodo?.items || [];
  return Array.isArray(items) ? items : [];
});
const nextPhaseTodos = computed(
  () => dailyAutopilot.value?.nextPhaseTodos || agentDailyTodo.value?.nextPhaseTodos || {},
);
const nextPhaseItems = computed(() => {
  const items = nextPhaseTodos.value?.items || [];
  return Array.isArray(items) ? items : [];
});
const dailyReviewMetrics = computed(
  () => agentDailyReview.value?.metrics || dailyAutopilot.value?.dailyReview?.metrics || {},
);
const patchChangeText = computed(() => {
  const changes = agentPatch.value?.changes || {};
  const entries = Object.entries(changes);
  if (!entries.length) return '没有可写入变更；继续 shadow/tester/paper 观察。';
  return entries.map(([key, value]) => `${key}=${value}`).join(' / ');
});

function formatScenarioDelta(item) {
  if (item.scenario === 'current') return item.netR == null ? '基准待补样本' : `${item.netR}R`;
  if (item.netRDelta == null) return '需要补回放';
  return `${item.netRDelta > 0 ? '+' : ''}${item.netRDelta}R`;
}

function scenarioVerdictZh(verdict) {
  const map = {
    baseline: '当前基准',
    needs_bar_replay: '需要 bar/tick 回放',
    no_action: '暂无动作',
  };
  return map[verdict] || verdict || '待验证';
}

function causalVariant(group, index) {
  const source = group === 'exit' ? barReplay.value?.exitComparison : barReplay.value?.entryComparison;
  const variants = Array.isArray(source?.variants) ? source.variants : [];
  return variants[index]?.metrics || {};
}

function causalMetric(group, index, key) {
  const value = causalVariant(group, index)[key];
  return value == null || value === '' ? '—' : value;
}

function signedMetric(value) {
  if (value === '—') return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return `${numeric > 0 ? '+' : ''}${numeric}`;
}

function ratioMetric(value) {
  if (value === '—') return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return `${Math.round(numeric * 100)}%`;
}

function metricText(value, suffix = '') {
  if (value == null || value === '') return '—';
  return `${value}${suffix}`;
}

function booleanEvidenceText(value) {
  if (value === true) return '开启';
  if (value === false) return '关闭';
  return '证据不可用';
}

function percentText(value) {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return `${Number(numeric.toFixed(1))}%`;
}

function statusZh(value, fallback = '等待自主代理处理') {
  const map = {
    COMPLETED_BY_AGENT: '自主代理已完成',
    AUTO_APPLIED_BY_AGENT: '自主代理已推动',
    WAITING_NEXT_PHASE: '等待下一阶段',
    PENDING: '等待自主代理',
    PROMOTED: '已晋级',
    MICRO_LIVE: 'MICRO_LIVE（已退役，按影子显示）',
    LIVE_LIMITED: 'LIVE_LIMITED（已退役，按影子显示）',
    ROLLBACK: '已回滚',
    PAUSED: '已暂停',
    REJECTED: '已淘汰',
    ELITE_SELECTED: '精英保留',
    PROMOTED_TO_SHADOW: '进入影子',
    NEEDS_MORE_DATA: '需要样本',
    SAFETY_REJECTED: '安全拒绝',
    PASS: '通过',
    WARN: '告警',
    FAIL: '失败',
    MISSING: '等待证据',
    READY: '就绪',
    RUNNING: '运行中',
    COMPLETED: '已完成',
  };
  const key = String(value || '').toUpperCase();
  return map[key] || value || fallback;
}

function evidenceQualityZh(value) {
  const map = {
    HIGH: '高质量',
    MEDIUM: '中等质量',
    LOW: '低质量',
    MISSING: '等待证据',
  };
  const key = String(value || '').toUpperCase();
  return map[key] || value || '等待证据';
}

function parityStatusZh(value) {
  const key = String(value || '').toUpperCase();
  if (key.includes('PASS')) return '三方口径一致';
  if (key.includes('FAIL')) return '三方口径不一致';
  if (key.includes('WARN')) return '三方口径待补证据';
  if (key.includes('MISSING')) return '等待三方证据';
  return value || '等待三方证据';
}

function boolZh(value) {
  if (value === true) return '通过';
  if (value === false) return '未通过';
  return '待同步';
}

function executionGateZh(value) {
  const map = {
    PASS: '影子 / 历史反馈可用',
    WATCH: '反馈质量观察',
    BLOCKED: '反馈证据阻断',
    WAITING_FEEDBACK: '等待影子 / 历史反馈',
    MISSING: '等待影子 / 历史反馈',
    UNKNOWN: '等待影子 / 历史反馈',
  };
  const key = String(value || '').toUpperCase();
  return map[key] || value || '等待影子 / 历史反馈';
}

function agentActionZh(value) {
  const map = {
    BLOCK_PROMOTION_AND_QUEUE_CASE_MEMORY: '阻断晋级并写入经验记忆',
    KEEP_SHADOW_AND_MONITOR_EXECUTION: '继续影子观察',
    ALLOW_EXECUTION_FEEDBACK_TO_SUPPORT_PROMOTION: '允许支持 Shadow 研究晋级',
    WAIT_FOR_LIVE_EXECUTION_FEEDBACK: '等待影子 / 历史反馈',
  };
  const key = String(value || '').toUpperCase();
  return map[key] || value || '等待影子 / 历史反馈';
}

function mutationHintZh(value) {
  const map = {
    relax_rsi_crossback: '放宽 RSI crossback',
    let_profit_run: '延后保本 / 多拿盈利',
    tighten_entry_filter: '收紧入场过滤',
    tighten_execution_filter: '收紧执行窗口 / 降仓',
    inspect_execution_quality: '检查拒单和执行质量',
    reduce_execution_latency: '降低执行延迟',
    verify_execution_ack_fill_sync: '核对 accepted/fill 回执同步',
    verify_ea_policy_sync: '核对 EA 与 policy 同步',
    verify_live_lane_strategy_lock: '核对已退役 live 字段的影子映射',
    keep_soft_news_gate: '保持软新闻门禁',
    reject_unstable_seed: '淘汰不稳定候选',
    reduce_mutation_rate: '降低遗传进化变异幅度',
  };
  return map[value] || value || '观察型候选';
}

function gaBacktest(item) {
  const summary = item?.fitnessBreakdown?.strategyBacktest || {};
  const audit = item?.audit?.backtest || {};
  const metrics = audit.metrics || {};
  if (!audit.present) return summary;
  return {
    ...summary,
    ...metrics,
    required: summary.required ?? true,
    present: true,
    ok: audit.ok ?? summary.ok,
    tradeCount: audit.tradeCount ?? metrics.tradeCount ?? summary.tradeCount,
    evidenceQuality: audit.evidenceQuality ?? summary.evidenceQuality,
    reasonZh: audit.reasonZh ?? summary.reasonZh,
  };
}

function gaBacktestMetric(item, key, digits = 2) {
  const value = gaBacktest(item)[key];
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (Number.isInteger(numeric)) return String(numeric);
  return String(Number(numeric.toFixed(digits)));
}

function gaBacktestWinRate(item) {
  const value = gaBacktest(item).winRate;
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return `${Number(numeric.toFixed(1))}%`;
}

function gaBacktestDrawdown(item) {
  const value = gaBacktest(item).maxDrawdownR;
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return `${Number(numeric.toFixed(3))}R`;
}

function gaBacktestSharpeSortino(item) {
  const backtest = gaBacktest(item);
  return `${gaBacktestMetric({ fitnessBreakdown: { strategyBacktest: backtest } }, 'sharpe')} / ${gaBacktestMetric(
    { fitnessBreakdown: { strategyBacktest: backtest } },
    'sortino',
  )}`;
}

function gaSeedBacktestStatus(item) {
  const backtest = gaBacktest(item);
  if (!backtest.required) return '未要求';
  if (!backtest.present) return '缺少回测';
  if (!backtest.ok) return '回测失败';
  return backtest.evidenceQuality || '已回测';
}

function gaHistoryProduction(item) {
  return item?.fitnessBreakdown?.historyProductionStatus || item?.historyProductionStatus || {};
}

function gaHistoryProductionStatus(item) {
  const production = gaHistoryProduction(item);
  const status = String(production.status || 'MISSING').toUpperCase();
  if (status === 'PASS' && production.historyTargetSatisfied) return '生产级 PASS';
  if (production.promotionGateStatus === 'BLOCKED') return '阻断晋级';
  if (status === 'WARN') return '生产告警';
  return '等待历史样本';
}

function gaHistoryProductionReason(item) {
  const production = gaHistoryProduction(item);
  return (
    production.reasonZh ||
    (production.historyTargetSatisfied
      ? '该 seed 使用生产级 USDJPY SQLite 历史样本评分。'
      : '该 seed 不能晋级：历史样本生产状态尚未 PASS。')
  );
}

function gaSeedParityStatus(item) {
  const parity = item?.fitnessBreakdown?.parity || {};
  if (!parity.present) return '等待';
  return parity.promotionGateStatus || parity.status || '已同步';
}

function gaSeedExecutionStatus(item) {
  const execution = item?.fitnessBreakdown?.executionFeedback || {};
  if (!execution.present) return '等待';
  return execution.promotionGateStatus || execution.fieldCompletenessStatus || '已同步';
}

function gaWalkForwardAudit(item) {
  return item?.audit?.walkForward || item?.fitnessBreakdown?.walkForward || {};
}

function gaWalkForwardSummary(item) {
  return gaWalkForwardAudit(item).summary || {};
}

function gaWalkForwardSegments(item) {
  const rows = gaWalkForwardAudit(item).segments;
  return Array.isArray(rows) ? rows : [];
}

function gaWalkForwardStatus(item) {
  const summary = gaWalkForwardSummary(item);
  const status = String(summary.promotionGateStatus || 'WAITING').toUpperCase();
  if (status === 'PASS') return '三段稳定 PASS';
  if (status === 'BLOCKED') return summary.blockerCode || '三段阻断';
  if (status === 'WARN') return '三段观察';
  return '等待三段评分';
}

function gaWalkForwardSegmentTitle(segment) {
  const map = {
    train: '训练段',
    validation: '验证段',
    forward: '前推段',
  };
  return map[segment?.segment] || segment?.labelZh || segment?.segment || '分段';
}

function gaBacktestAudit(item) {
  return item?.audit?.backtest || {};
}

function gaEquityPoints(item) {
  const points = gaBacktestAudit(item).equityCurve;
  return Array.isArray(points) ? points : [];
}

function gaEquityPolyline(item) {
  const points = gaEquityPoints(item);
  if (points.length < 2) return '';
  const xs = points.map((point) => Number(point.index));
  const ys = points.map((point) => Number(point.equityR));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(0.0001, maxY - minY);
  return points
    .map((point) => {
      const x = ((Number(point.index) - minX) / spanX) * 232 + 4;
      const y = 68 - ((Number(point.equityR) - minY) / spanY) * 60;
      return `${Number(x.toFixed(2))},${Number(y.toFixed(2))}`;
    })
    .join(' ');
}

function gaLineageAudit(item) {
  return item?.audit?.lineage || {};
}

function gaLineageTree(item) {
  return item?.audit?.lineageTree || gaLineageAudit(item).tree || {};
}

function gaLineageTreeNodes(item) {
  const nodes = gaLineageTree(item).nodes;
  return Array.isArray(nodes) ? nodes : [];
}

function gaLineagePath(item) {
  return item?.audit?.lineagePath || {};
}

function gaLineagePathNodes(item) {
  const nodes = gaLineagePath(item).nodes;
  return Array.isArray(nodes) ? nodes : [];
}

function gaCandidateHasLineagePath(item) {
  return gaLineagePathNodes(item).length > 0;
}

function gaLineagePathSummary(item) {
  const path = gaLineagePath(item);
  if (!path.nodeCount) return '等待主血统';
  const generationText = path.generationCount ? `${path.generationCount} 代` : '未标记代数';
  const delta = path.fitnessDelta == null ? '—' : path.fitnessDelta;
  return `${path.nodeCount} 节点 / ${generationText} / 适应度变化 ${delta}`;
}

function gaLineagePathNodeTitle(node) {
  const generation = node.generation == null ? '外部线索' : `第 ${node.generation} 代`;
  const latest =
    node.latestGeneration && node.latestGeneration !== node.generation
      ? ` / 最新复用第 ${node.latestGeneration} 代`
      : '';
  const edge = node.lineageEdgeType ? ` / ${lineageEdgeTypeZh(node.lineageEdgeType)}` : '';
  return `${generation}${latest}${edge}`;
}

function gaLineagePathNodeMeta(node) {
  const fitness = node.fitness == null ? '—' : node.fitness;
  const delta = node.fitnessDeltaFromPrevious == null ? '—' : node.fitnessDeltaFromPrevious;
  return `${node.strategyFamily || '策略族'} / ${node.source || '未知来源'} / 适应度 ${fitness} / 变化 ${delta}`;
}

function gaVisibleLineageTreeNodes(item) {
  const nodes = gaLineageTreeNodes(item);
  if (lineageTreeExpanded.value) return nodes;
  return nodes.filter(
    (node) => !node.foldedByDefault || node.selected || node.onElitePath || node.eliteSelected,
  );
}

function gaLineageTreeEdges(item) {
  const edges = gaLineageTree(item).edges;
  if (!Array.isArray(edges)) return [];
  const visibleIds = new Set(gaVisibleLineageTreeNodes(item).map((node) => String(node.seedId || '')));
  return edges.filter((edge) => {
    const from = String(edge.from || '');
    const to = String(edge.to || '');
    return visibleIds.has(from) && visibleIds.has(to);
  });
}

function gaLineageTreeLevels(item) {
  const grouped = new Map();
  for (const node of gaVisibleLineageTreeNodes(item)) {
    const depth = Number(node.relativeDepth || 0);
    if (!grouped.has(depth)) grouped.set(depth, []);
    grouped.get(depth).push(node);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([depth, nodes]) => ({
      depth,
      nodes: nodes.sort((left, right) => String(left.seedId || '').localeCompare(String(right.seedId || ''))),
    }));
}

function gaLineageTreeSummary(item) {
  const tree = gaLineageTree(item);
  if (!tree.nodeCount) return '等待进化树';
  const hidden = gaLineageTreeHiddenCount(item);
  const elitePath = tree.elitePathCount ? ` / 精英路径 ${tree.elitePathCount}` : '';
  const hiddenText = hidden && !lineageTreeExpanded.value ? ` / 折叠 ${hidden}` : '';
  return `${tree.nodeCount} 节点 / ${tree.edgeCount || 0} 边${elitePath}${hiddenText}`;
}

function gaLineageTreeHiddenCount(item) {
  const nodes = gaLineageTreeNodes(item);
  return nodes.filter(
    (node) => node.foldedByDefault && !node.selected && !node.onElitePath && !node.eliteSelected,
  ).length;
}

function gaLineageLevelTitle(depth) {
  const numeric = Number(depth || 0);
  if (numeric < 0) return `祖先 ${Math.abs(numeric)} 层`;
  if (numeric > 0) return `子代 +${numeric}`;
  return '当前 Seed';
}

function gaLineageNodeMeta(node) {
  const generation = node.generation == null ? '外部' : `第 ${node.generation} 代`;
  const source = node.source || 'UNKNOWN';
  const family = node.strategyFamily || '策略族';
  const fitness = node.fitness == null ? '—' : node.fitness;
  return `${generation} / ${family} / ${source} / 适应度 ${fitness}`;
}

function lineageEdgeTypeZh(value) {
  const map = {
    MUTATION: '参数变异',
    CROSSOVER: '同族交叉',
    CASE_MEMORY: '经验记忆线索',
    LINK: '关联',
  };
  const key = String(value || 'LINK').toUpperCase();
  return map[key] || value || '关联';
}

function gaSourceTrace(item) {
  return item?.audit?.sourceTrace || {};
}

function gaLineageSummary(item) {
  const audit = gaLineageAudit(item);
  return `父代 ${audit.parentCount || 0} / 子代 ${audit.childCount || 0}`;
}

function gaLineageParentsText(item) {
  const parents = gaLineageAudit(item).parents;
  if (!Array.isArray(parents) || !parents.length) return '父代：—';
  return `父代：${parents.map((parent) => `${parent.seedId || 'unknown'}(${parent.type || 'LINK'})`).join(' / ')}`;
}

function gaEvidenceChain(item) {
  const chain = item?.audit?.evidenceChain;
  if (Array.isArray(chain) && chain.length) return chain;
  return [
    {
      step: '策略契约校验',
      status: item?.validation?.valid ? 'PASS' : 'WAITING',
      reasonZh: item?.validation?.reasonZh || '等待点击候选加载完整审计。',
    },
    {
      step: 'USDJPY SQLite 回测',
      status: gaSeedBacktestStatus(item),
      reasonZh: gaBacktest(item).reasonZh || '列表只展示摘要，点击后加载完整回测证据。',
    },
    {
      step: '适应度 / 晋级',
      status: item?.status || 'WAITING',
      reasonZh: item?.blockerZh || '等待完整候选审计。',
    },
  ];
}

function gaAuditTrades(item) {
  const trades = gaBacktestAudit(item).trades;
  return Array.isArray(trades) ? trades : [];
}

function gaEvidenceGateSummary(item) {
  return `${gaSeedParityStatus(item)} / ${gaSeedExecutionStatus(item)}`;
}

function conclusionZh(value) {
  const map = {
    REJECTED: '拒绝',
    SHADOW: '模拟观察',
    FAST_SHADOW: '快速模拟',
    SHADOW_ONLY: '只进影子',
    TESTER_ONLY: '只进测试器',
    PAPER_LIVE_SIM: '行情干跑（只读）',
    MICRO_LIVE: 'MICRO_LIVE（已退役，按影子显示）',
    LIVE_LIMITED: 'LIVE_LIMITED（已退役，按影子显示）',
    PAUSED: '暂停',
    ROLLBACK: '自动回滚',
    QUARANTINED: '隔离',
    PAPER_CONTEXT: '事件参考',
    LIVE_CONFIG_PROPOSAL_ELIGIBLE: '旧配置提案字段（只读）',
  };
  return map[value] || value || '待补样本';
}

function directionZh(value) {
  const text = String(value || '').toUpperCase();
  if (text === 'LONG' || text === 'BUY') return '买入';
  if (text === 'SHORT' || text === 'SELL') return '卖出';
  return value || '—';
}

function strategyJsonPreview(value) {
  if (!value) return '{}';
  try {
    return JSON.stringify(value, null, 2).slice(0, 1800);
  } catch (_err) {
    return '{}';
  }
}

function actionTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function setActionStatus(kind, title, summary) {
  actionStatus.value = { kind, title, summary, time: actionTime() };
}

function setActionRunning(title, summary = '自主代理正在写入本地证据并刷新页面，请稍等。') {
  setActionStatus('running', title, summary);
}

function setActionSuccess(title, summary) {
  setActionStatus('success', title, summary);
}

function setActionError(title, err, fallback) {
  setActionStatus('error', title, err?.message || fallback);
}

function barReplaySummary() {
  const summary = barReplay.value?.summary || {};
  const entryVariants = barReplay.value?.entryComparison?.variants?.length || 0;
  const exitVariants = barReplay.value?.exitComparison?.variants?.length || 0;
  const sampleCount = summary.sampleCount ?? summary.samples ?? 0;
  return `已生成因果回放：样本 ${sampleCount}；入场候选 ${entryVariants} 组；出场候选 ${exitVariants} 组。`;
}

function governanceSummary() {
  const stage = statusZh(
    autonomousAgent.value?.executionStage ||
      autonomousAgent.value?.stage ||
      lifecyclePayload.value?.executionStage,
    '等待治理门',
  );
  const liveStage = statusZh(liveLane.value?.executionStage || liveLane.value?.stage, 'Shadow Advisory 等待');
  const mt5Count = mt5ShadowSummary.value?.totalRoutes ?? mt5ShadowSummary.value?.routeCount ?? 0;
  return `自主治理已运行：代理阶段 ${stage}；Shadow Advisory ${liveStage}；MT5 模拟车道 ${mt5Count} 条路线；无 execution lane。`;
}

function dailySummary() {
  const todoCount = dailyTodoItems.value.length;
  const nextCount = nextPhaseItems.value.length;
  const reviewState = statusZh(
    agentDailyReview.value?.status || dailyAutopilot.value?.dailyReview?.status,
    '复盘已刷新',
  );
  return `自动日报已生成：今日待办 ${todoCount} 条；下一阶段任务 ${nextCount} 条；每日复盘 ${reviewState}。`;
}

function gaSummary() {
  const status = gaStatus.value;
  return `遗传进化已运行：第 ${status.currentGeneration || 0} 代；种群 ${status.populationSize || 0}；精英 ${status.eliteCount || 0}；阻断 ${status.blockedCandidates || 0}。`;
}

function gaFactorySummary() {
  const state = gaFactoryPayload.value?.state || gaFactoryPayload.value || {};
  const lock = state.evolutionLockPolicy?.personalityLocked ? '性格锁已启用' : '等待性格锁';
  return `GA 工厂已生成：候选 ${state.candidateCount || 0}；elite ${state.eliteCount || 0}；墓园 ${state.graveyardCount || 0}；lineage ${state.lineageNodeCount || 0}；${lock}。`;
}

function strategyFactoryIntentSummary() {
  const state = strategyIntentPlanPayload.value?.plan || strategyIntentPlanPayload.value || {};
  const personality = state.inferredPersonality || {};
  const seedCount = state.validation?.validSeedCount || 0;
  return `大白话策略已生成：${personality.strategyFamily || 'UNKNOWN'}；方向 ${(personality.directions || []).join('/') || 'UNKNOWN'}；有效 seed ${seedCount}；只进 shadow。`;
}

function telegramGatewayOpsSummary() {
  const state = telegramGatewayOpsPayload.value?.status || telegramGatewayOpsPayload.value || {};
  return `Telegram Gateway 已收集：队列 ${state.queuedCount || 0}；待投递 ${state.pendingCount || 0}；真实发送 ${state.actualSentCount || 0}；抑制 ${state.suppressedCount || 0}。`;
}

function strategyBacktestSummary() {
  const metrics = strategyBacktestMetrics.value;
  return `策略回测已完成：交易 ${metrics.tradeCount || 0} 笔；净 R ${metrics.netR ?? 0}；PF ${metrics.profitFactor ?? 0}。`;
}

function strategyContractSummary() {
  return `EA 只读契约已生成：${strategyContractSeed.value}；${strategyContractEAStatusZh.value}；${strategyContractShadowEvalStatusZh.value}；不会下单或修改 preset。`;
}

function evidenceOSSummary() {
  return `证据系统已生成：一致性 ${parityStatusZh(parityStatus.value)}；${executionGateStatusZh.value}；经验 ${caseMemory.value.caseCount || 0} 个，遗传进化种子线索 ${gaSeedHints.value.length} 条。`;
}

function caseMemoryCandidateSummary() {
  const report = caseMemoryCandidatePayload.value?.report || caseMemoryCandidatePayload.value || {};
  const parity = report?.parityGate?.status || report?.parityStatus || parityStatus.value;
  const candidates = report?.candidateCount || report?.candidates?.length || 0;
  const seeds = report?.gaSeedCount || report?.gaSeeds?.length || gaSeedHints.value.length;
  return `经验候选已生成：Parity ${parity}；shadow Strategy JSON candidate ${candidates} 个；GA seed ${seeds} 条。`;
}

function evolutionSummary() {
  const samples = datasetSummary.value?.sampleCount ?? datasetSummary.value?.totalSamples ?? 0;
  const candidates = candidateItems.value.length;
  const agentStage = statusZh(
    autonomousAgent.value?.executionStage || autonomousAgent.value?.stage,
    '等待自主代理',
  );
  return `复盘闭环已生成：运行样本 ${samples}；参数候选 ${candidates} 个；代理阶段 ${agentStage}。`;
}

function gaCandidateSelectionGeneration(item) {
  return Number(item?.latestGeneration ?? item?.generation ?? item?.audit?.generation ?? 0) || 0;
}

function gaCandidateSelectionRank(item) {
  const rank = Number(item?.rank);
  return Number.isFinite(rank) ? rank : 9999;
}

function gaCandidateSelectionFitness(item) {
  const fitness = Number(item?.fitness ?? item?.fitnessBreakdown?.fitness);
  return Number.isFinite(fitness) ? fitness : -9999;
}

function gaCandidateStatusPriority(item) {
  const status = String(item?.status || '').toUpperCase();
  if (status === 'ELITE_SELECTED') return 5;
  if (status === 'PROMOTED_TO_SHADOW') return 4;
  if (status === 'TESTER_ONLY' || status === 'PAPER_LIVE_SIM') return 3;
  if (status === 'NEEDS_MORE_DATA') return 2;
  if (status === 'REJECTED') return 0;
  return 1;
}

function gaCandidateLineageSourcePriority(item) {
  const source = String(item?.source || '').toUpperCase();
  if (source === 'CROSSOVER') return 4;
  if (source === 'MUTATION') return 3;
  if (source === 'CASE_MEMORY') return 2;
  if (source === 'LLM_SEED' || source === 'MANUAL_ARCHIVE_IMPORT') return 1;
  return 0;
}

function comparePreferredGASeedCandidate(a, b) {
  return (
    gaCandidateSelectionGeneration(b) - gaCandidateSelectionGeneration(a) ||
    gaCandidateStatusPriority(b) - gaCandidateStatusPriority(a) ||
    gaCandidateLineageSourcePriority(b) - gaCandidateLineageSourcePriority(a) ||
    gaCandidateSelectionRank(a) - gaCandidateSelectionRank(b) ||
    gaCandidateSelectionFitness(b) - gaCandidateSelectionFitness(a) ||
    String(a?.seedId || '').localeCompare(String(b?.seedId || ''))
  );
}

function preferredGASeedCandidateQueue(candidates) {
  const rows = Array.isArray(candidates) ? candidates.filter((item) => item?.seedId) : [];
  return [...rows].sort(comparePreferredGASeedCandidate);
}

async function selectGASeed(item, { auto = false } = {}) {
  if (!item?.seedId) return;
  if (!auto) gaSeedSelectionPinned.value = true;
  lineageTreeExpanded.value = false;
  selectedGASeed.value = item;
  selectedGASeedLoading.value = true;
  selectedGASeedError.value = '';
  try {
    const payload = await fetchUSDJPYGACandidate(item.seedId);
    selectedGASeed.value = payload?.candidate || item;
  } catch (err) {
    selectedGASeedError.value = err?.message || 'GA 候选完整审计读取失败';
  } finally {
    selectedGASeedLoading.value = false;
  }
}

function selectPreferredGASeedWithLineage(candidates) {
  if (gaSeedSelectionPinned.value && selectedGASeed.value?.seedId) return;

  const queue = preferredGASeedCandidateQueue(candidates);
  if (!queue.length) {
    selectedGASeed.value = null;
    return;
  }

  selectedGASeed.value = queue.find(gaCandidateHasLineagePath) || queue[0];
  selectedGASeedLoading.value = false;
  selectedGASeedError.value = '';
  lineageTreeExpanded.value = false;
}

function assignLoaded(results) {
  payload.value = results.evolutionPayload;
  barReplay.value = results.causalPayload;
  walkForward.value = results.walkForwardPayload;
  autonomousAgent.value = results.autonomousPayload;
  lifecyclePayload.value = results.lifecycle;
  lanesPayload.value = results.lanesState;
  mt5ShadowPayload.value = results.mt5ShadowState;
  eaReproPayload.value = results.eaReproState;
  dailyAutopilot.value = results.dailyState;
  agentDailyTodo.value = results.dailyTodoState || results.dailyState?.dailyTodo || null;
  agentDailyReview.value = results.dailyReviewState || results.dailyState?.dailyReview || null;
  gaPayload.value = results.gaState;
  gaCandidatesPayload.value = results.gaCandidates;
  gaPathPayload.value = results.gaPath;
  gaBlockersPayload.value = results.gaBlockers;
  gaFactoryPayload.value = results.gaFactoryState;
  strategyIntentPlanPayload.value = results.strategyIntentPlanState;
  strategyBacktestPayload.value = results.strategyBacktestState;
  historyProductionPayload.value = results.historyProductionState;
  productionEvidencePayload.value = results.productionEvidenceState;
  evidenceOSPayload.value = results.evidenceOSState;
  caseMemoryCandidatePayload.value = results.caseMemoryCandidateState;
  telegramGatewayPayload.value = results.telegramGatewayState;
  telegramGatewayOpsPayload.value = results.telegramGatewayOpsState;
  strategyContractPayload.value = results.strategyContractState;
}

async function loadEvolutionEntries(entries, options = {}, concurrency = 6) {
  const results = {};
  let cursor = 0;

  async function worker() {
    while (cursor < entries.length && !options.signal?.aborted) {
      const [key, loadEntry] = entries[cursor];
      cursor += 1;
      results[key] = await loadEntry();
    }
  }

  const workerCount = Math.min(concurrency, entries.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function loadAll(options = {}) {
  const results = await loadEvolutionEntries(
    [
      ['evolutionPayload', () => fetchUSDJPYEvolutionStatus(options)],
      ['causalPayload', () => fetchUSDJPYBarReplayStatus({}, options)],
      ['walkForwardPayload', () => fetchUSDJPYWalkForwardStatus({}, options)],
      ['autonomousPayload', () => fetchUSDJPYAutonomousAgent({}, options)],
      ['lifecycle', () => fetchUSDJPYAutonomousLifecycle({}, options)],
      ['lanesState', () => fetchUSDJPYAutonomousLanes({}, options)],
      ['mt5ShadowState', () => fetchUSDJPYMt5ShadowLane({}, options)],
      ['eaReproState', () => fetchUSDJPYEaReproducibility({}, options)],
      ['dailyState', () => fetchUSDJPYDailyAutopilotV2({}, options)],
      ['dailyTodoState', () => fetchUSDJPYAgentDailyTodo({}, options)],
      ['dailyReviewState', () => fetchUSDJPYAgentDailyReview({}, options)],
      ['gaState', () => fetchUSDJPYGAStatus({}, options)],
      ['gaCandidates', () => fetchUSDJPYGACandidates(options)],
      ['gaPath', () => fetchUSDJPYGAEvolutionPath(options)],
      ['gaBlockers', () => fetchUSDJPYGABlockers(options)],
      ['gaFactoryState', () => fetchStrategyGaFactoryStatus(options)],
      ['strategyIntentPlanState', () => fetchStrategyFactoryIntentPlan(options)],
      ['strategyBacktestState', () => fetchUSDJPYStrategyBacktestStatus(options)],
      ['historyProductionState', () => fetchUSDJPYStrategyBacktestProductionStatus(options)],
      ['productionEvidenceState', () => fetchProductionEvidenceStatus(options)],
      ['evidenceOSState', () => fetchUSDJPYEvidenceOSStatus(options)],
      ['caseMemoryCandidateState', () => fetchCaseMemoryStatus(options)],
      ['telegramGatewayState', () => fetchUSDJPYTelegramGatewayStatus(options)],
      ['telegramGatewayOpsState', () => fetchTelegramGatewayOpsStatus(options)],
      ['strategyContractState', () => fetchUSDJPYStrategyContractStatus({}, options)],
    ],
    options,
    6,
  );
  if (options.signal?.aborted) return false;
  assignLoaded(results);
  const schedule =
    typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback
      : typeof window !== 'undefined'
        ? (callback) => window.setTimeout(callback, 80)
        : (callback) => callback();
  schedule(() => {
    if (options.signal?.aborted) return;
    selectPreferredGASeedWithLineage(results.gaCandidates?.candidates);
  });
  return true;
}

async function load({ silent = false } = {}) {
  loadController?.abort();
  const runId = loadRunId + 1;
  loadRunId = runId;
  const controller = new globalThis.AbortController();
  loadController = controller;
  loading.value = true;
  error.value = '';
  if (!silent)
    setActionRunning('自主代理正在刷新页面证据', '正在读取 USDJPY 数据集、回放、治理、MT5 车道和日报状态。');
  try {
    const loaded = await loadAll({ signal: controller.signal });
    if (!loaded || controller.signal.aborted || runId !== loadRunId) return;
    if (!silent) setActionSuccess('自主代理证据已刷新', evolutionSummary());
  } catch (err) {
    if (controller.signal.aborted || runId !== loadRunId) return;
    error.value = err?.message || 'USDJPY 自学习闭环加载失败';
    if (!silent) setActionError('自主代理刷新失败', err, 'USDJPY 自学习闭环加载失败');
  } finally {
    if (runId === loadRunId) {
      loading.value = false;
      loadController = null;
    }
  }
}

async function runAutonomousGovernance() {
  loading.value = true;
  error.value = '';
  setActionRunning('自主代理正在运行治理门', '正在执行前向验证、治理门和 Shadow 生命周期刷新。');
  try {
    await runUSDJPYWalkForwardBuild();
    autonomousAgent.value = await runUSDJPYAutonomousAgent();
    await loadAll();
    setActionSuccess('自主治理已完成', governanceSummary());
  } catch (err) {
    error.value = err?.message || 'USDJPY 自主治理运行失败';
    setActionError('自主治理失败', err, 'USDJPY 自主治理运行失败');
  } finally {
    loading.value = false;
  }
}

async function runDailyAutopilotV2() {
  loading.value = true;
  error.value = '';
  setActionRunning('自主代理正在生成自动日报', '正在生成今日待办、每日复盘和下一阶段任务。');
  try {
    dailyAutopilot.value = await runUSDJPYDailyAutopilotV2();
    agentDailyTodo.value = await runUSDJPYAgentDailyTodo();
    agentDailyReview.value = await runUSDJPYAgentDailyReview();
    await loadAll();
    setActionSuccess('自动日报已完成', dailySummary());
  } catch (err) {
    error.value = err?.message || 'USDJPY 自动日报生成失败';
    setActionError('自动日报失败', err, 'USDJPY 自动日报生成失败');
  } finally {
    loading.value = false;
  }
}

async function runGAGeneration() {
  loading.value = true;
  error.value = '';
  setActionRunning(
    '自主代理正在运行遗传进化',
    '正在生成策略契约种子、评分适应度、选择精英并写入全过程审计。',
  );
  try {
    gaPayload.value = await runUSDJPYGAGeneration();
    await loadAll();
    setActionSuccess('遗传进化已完成', gaSummary());
  } catch (err) {
    error.value = err?.message || 'USDJPY 遗传进化运行失败';
    setActionError('遗传进化失败', err, 'USDJPY 遗传进化运行失败');
  } finally {
    loading.value = false;
  }
}

async function runGAFactoryBuild() {
  loading.value = true;
  error.value = '';
  setActionRunning(
    '自主代理正在生成 GA 工厂',
    '正在归档 Strategy JSON 候选、elite archive、策略墓园和 lineage tree。',
  );
  try {
    gaFactoryPayload.value = await buildStrategyGaFactory();
    await loadAll();
    setActionSuccess('GA 工厂已完成', gaFactorySummary());
  } catch (err) {
    error.value = err?.message || 'USDJPY GA Factory 生成失败';
    setActionError('GA 工厂失败', err, 'USDJPY GA Factory 生成失败');
  } finally {
    loading.value = false;
  }
}

async function runStrategyFactoryIntentPlan(prompt = '') {
  loading.value = true;
  error.value = '';
  setActionRunning(
    '自主代理正在生成大白话策略',
    '正在把自然语言意图转成 shadow-only Strategy JSON seed 和性格锁进化计划。',
  );
  try {
    strategyIntentPlanPayload.value = await buildStrategyFactoryIntentPlan({ prompt });
    await loadAll();
    setActionSuccess('大白话策略已生成', strategyFactoryIntentSummary());
  } catch (err) {
    error.value = err?.message || 'Strategy Factory intent plan 生成失败';
    setActionError('大白话策略失败', err, 'Strategy Factory intent plan 生成失败');
  } finally {
    loading.value = false;
  }
}

async function runTelegramGatewayOpsCollect() {
  loading.value = true;
  error.value = '';
  setActionRunning(
    '自主代理正在收集通知报告',
    '正在把 USDJPY 日报、GA 和 Agent 报告送入 push-only Gateway 队列。',
  );
  try {
    telegramGatewayOpsPayload.value = await collectTelegramGatewayOps();
    await loadAll();
    setActionSuccess('通知报告已收集', telegramGatewayOpsSummary());
  } catch (err) {
    error.value = err?.message || 'Telegram Gateway 运维收集失败';
    setActionError('通知收集失败', err, 'Telegram Gateway 运维收集失败');
  } finally {
    loading.value = false;
  }
}

async function runStrategyContract() {
  loading.value = true;
  error.value = '';
  setActionRunning(
    '自主代理正在生成 EA 只读契约',
    '正在把最新策略契约候选写成 EA 可读取的模拟/测试器/MT5 行情只读评估契约。',
  );
  try {
    strategyContractPayload.value = await buildUSDJPYStrategyContract();
    await loadAll();
    setActionSuccess('EA 契约已生成', strategyContractSummary());
  } catch (err) {
    error.value = err?.message || '策略契约 → EA 契约生成失败';
    setActionError('EA 契约失败', err, '策略契约 → EA 契约生成失败');
  } finally {
    loading.value = false;
  }
}

async function runStrategyBacktest() {
  loading.value = true;
  error.value = '';
  setActionRunning(
    '自主代理正在运行策略回测',
    '正在用策略契约读取 USDJPY SQLite K线，并生成交易、权益曲线和遗传进化证据。',
  );
  try {
    await syncUSDJPYStrategyBacktestKlines();
    strategyBacktestPayload.value = await runUSDJPYStrategyBacktest();
    await loadAll();
    setActionSuccess('策略回测已完成', strategyBacktestSummary());
  } catch (err) {
    error.value = err?.message || 'USDJPY 策略契约回测失败';
    setActionError('策略回测失败', err, 'USDJPY 策略契约回测失败');
  } finally {
    loading.value = false;
  }
}

async function runEvidenceOS() {
  loading.value = true;
  error.value = '';
  setActionRunning(
    '自主代理正在生成证据系统',
    '正在同步 USDJPY K线、运行策略契约回测、三方一致性、影子/历史反馈和经验记忆。',
  );
  try {
    await syncUSDJPYStrategyBacktestKlines();
    strategyBacktestPayload.value = await runUSDJPYStrategyBacktest();
    evidenceOSPayload.value = await runUSDJPYEvidenceOS();
    await loadAll();
    setActionSuccess('证据 OS 已完成', evidenceOSSummary());
  } catch (err) {
    error.value = err?.message || 'USDJPY 证据 OS 生成失败';
    setActionError('证据 OS 失败', err, 'USDJPY 证据 OS 生成失败');
  } finally {
    loading.value = false;
  }
}

async function runCaseMemoryBuild() {
  loading.value = true;
  error.value = '';
  setActionRunning(
    '自主代理正在生成经验候选',
    '正在把错失机会、早出场、影子/历史反馈和 GA blocker 转成 shadow Strategy JSON candidate。',
  );
  try {
    caseMemoryCandidatePayload.value = await buildCaseMemoryCandidates();
    await loadAll();
    setActionSuccess('经验候选已完成', caseMemoryCandidateSummary());
  } catch (err) {
    error.value = err?.message || 'USDJPY Case Memory 候选生成失败';
    setActionError('经验候选失败', err, 'USDJPY Case Memory 候选生成失败');
  } finally {
    loading.value = false;
  }
}

async function runCausalReplay() {
  loading.value = true;
  error.value = '';
  setActionRunning('自主代理正在生成因果回放', '正在运行因果回放；未来后验只用于评分，不用于触发。');
  try {
    barReplay.value = await runUSDJPYBarReplayBuild();
    await loadAll();
    setActionSuccess('因果回放已完成', barReplaySummary());
  } catch (err) {
    error.value = err?.message || 'USDJPY 因果回放生成失败';
    setActionError('因果回放失败', err, 'USDJPY 因果回放生成失败');
  } finally {
    loading.value = false;
  }
}

async function runFullEvolution() {
  loading.value = true;
  error.value = '';
  setActionRunning('自主代理正在生成复盘闭环', '正在按顺序生成数据集、回放、参数候选、自主治理和日报。');
  try {
    await runUSDJPYEvolutionBuild();
    await runUSDJPYReplayReport();
    await runUSDJPYBarReplayBuild();
    await syncUSDJPYStrategyBacktestKlines();
    await runUSDJPYStrategyBacktest();
    await runUSDJPYEvidenceOS();
    await buildCaseMemoryCandidates();
    await runUSDJPYWalkForwardBuild();
    await runUSDJPYParamTuning();
    await runUSDJPYConfigProposal();
    await runUSDJPYAutonomousAgent();
    await runUSDJPYDailyAutopilotV2();
    await loadAll();
    setActionSuccess('复盘闭环已完成', evolutionSummary());
  } catch (err) {
    error.value = err?.message || 'USDJPY 自学习闭环生成失败';
    setActionError('复盘闭环失败', err, 'USDJPY 自学习闭环生成失败');
  } finally {
    loading.value = false;
  }
}

function revealDeepEvidencePanels(event) {
  deepEvidencePanelsVisible.value = deepEvidencePanelsVisible.value || Boolean(event.target.open);
}

function revealProductionPanels(event) {
  productionPanelsVisible.value = productionPanelsVisible.value || Boolean(event.target.open);
}

onMounted(() => load({ silent: true }));
onBeforeUnmount(() => {
  loadController?.abort();
  loadController = null;
});
</script>

<style scoped>
.qg-usdjpy-evolution {
  display: grid;
  gap: 16px;
  min-width: 0;
  border: 1px solid rgba(80, 171, 255, 0.22);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(10, 35, 58, 0.72), rgba(10, 16, 28, 0.92) 38%, rgba(12, 20, 25, 0.94)),
    rgba(6, 14, 28, 0.98);
  padding: clamp(14px, 1.8vw, 20px);
  color: #eaf2ff;
}

.qg-usdjpy-evolution > *,
.qg-usdjpy-evolution__header > *,
.qg-usdjpy-evolution__actions > *,
.qg-usdjpy-evolution__primary-actions > *,
.qg-usdjpy-evolution__more-actions > *,
.qg-usdjpy-evolution__list > *,
.qg-usdjpy-evolution__section-head > *,
.qg-usdjpy-evolution__scenario-grid > *,
.qg-usdjpy-evolution__mini-list > * {
  min-width: 0;
  max-width: 100%;
}

.qg-usdjpy-evolution__header {
  order: 1;
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(280px, 460px);
  gap: 18px;
  align-items: start;
  border-bottom: 1px solid rgba(145, 170, 210, 0.16);
  padding-bottom: 16px;
}

.qg-usdjpy-evolution__eyebrow {
  margin: 0 0 6px;
  color: #7ecbff;
  font-size: 13px;
  font-weight: 800;
}

.qg-usdjpy-evolution h2,
.qg-usdjpy-evolution h3,
.qg-usdjpy-evolution p {
  margin: 0;
  overflow-wrap: anywhere;
}

.qg-usdjpy-evolution__header p:not(.qg-usdjpy-evolution__eyebrow) {
  color: #aebbd0;
  margin-top: 8px;
}

.qg-usdjpy-evolution__actions {
  display: grid;
  gap: 10px;
  align-self: start;
}

.qg-usdjpy-evolution__primary-actions,
.qg-usdjpy-evolution__more-actions div {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.qg-usdjpy-evolution button {
  border: 1px solid rgba(126, 203, 255, 0.45);
  border-radius: 8px;
  background: rgba(12, 39, 66, 0.9);
  color: #dff2ff;
  min-height: 38px;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
}

.qg-usdjpy-evolution__button--primary {
  border-color: rgba(103, 232, 149, 0.5) !important;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.28), rgba(14, 116, 144, 0.24)) !important;
  color: #edfff8 !important;
}

.qg-usdjpy-evolution__more-actions {
  min-width: 0;
}

.qg-usdjpy-evolution__more-actions summary,
.qg-usdjpy-evolution__list summary {
  cursor: pointer;
  color: #bfe7ff;
  font-size: 13px;
  font-weight: 850;
}

.qg-usdjpy-evolution__more-actions div {
  margin-top: 8px;
}

.qg-usdjpy-evolution__action-result {
  order: 2;
  border: 1px solid rgba(126, 203, 255, 0.35);
  border-radius: 8px;
  background: rgba(7, 22, 38, 0.86);
  padding: 12px 14px;
}

.qg-usdjpy-evolution__action-result div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.qg-usdjpy-evolution__action-result strong {
  font-size: 15px;
}

.qg-usdjpy-evolution__action-result span,
.qg-usdjpy-evolution__action-result p {
  color: #aebbd0;
}

.qg-usdjpy-evolution__action-result p {
  margin-top: 6px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.qg-usdjpy-evolution__action-result--running {
  border-color: rgba(126, 203, 255, 0.55);
}

.qg-usdjpy-evolution__action-result--success {
  border-color: rgba(103, 232, 149, 0.45);
}

.qg-usdjpy-evolution__action-result--error {
  border-color: rgba(248, 113, 113, 0.55);
}

.qg-usdjpy-evolution__grid {
  order: 3;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.qg-usdjpy-evolution__card,
.qg-usdjpy-evolution__list article {
  border: 1px solid rgba(145, 170, 210, 0.22);
  border-radius: 8px;
  background: rgba(6, 18, 34, 0.7);
  padding: 13px;
  min-width: 0;
  overflow: hidden;
}

.qg-usdjpy-evolution__card--featured {
  border-color: rgba(103, 232, 149, 0.34);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 18, 34, 0.72));
}

.qg-usdjpy-evolution__card span {
  color: #aebbd0;
  font-size: 13px;
  font-weight: 700;
}

.qg-usdjpy-evolution__card strong {
  display: block;
  margin-top: 7px;
  font-size: clamp(18px, 1.7vw, 24px);
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.qg-usdjpy-evolution__card p,
.qg-usdjpy-evolution__list p,
.qg-usdjpy-evolution__list span {
  color: #aebbd0;
  margin-top: 7px;
  line-height: 1.42;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.qg-usdjpy-evolution__list article span,
.qg-usdjpy-evolution__list article strong {
  display: block;
  max-width: 100%;
}

.qg-usdjpy-evolution__list article strong {
  margin-top: 6px;
  font-size: clamp(18px, 1.4vw, 22px);
  line-height: 1.18;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.qg-usdjpy-evolution__list {
  margin-top: 0;
  display: grid;
  gap: 10px;
  border: 1px solid rgba(145, 170, 210, 0.16);
  border-radius: 8px;
  padding: 14px;
  overflow: hidden;
  background: rgba(5, 14, 27, 0.48);
}

.qg-usdjpy-evolution__chapter-label {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: 0;
  margin-top: 8px;
  border-top: 1px solid rgba(145, 170, 210, 0.2);
  padding-top: 16px;
}

.qg-usdjpy-evolution__chapter-label > span {
  display: grid;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid rgba(126, 203, 255, 0.3);
  border-radius: 8px;
  color: #dff2ff;
  background: rgba(13, 42, 66, 0.68);
  font-size: 12px;
  font-weight: 900;
}

.qg-usdjpy-evolution__chapter-label strong {
  display: block;
  color: #f8fbff;
  font-size: 16px;
}

.qg-usdjpy-evolution__chapter-label p {
  margin-top: 3px;
  color: #9fb0c8;
}

.qg-usdjpy-evolution__chapter-label--learning {
  order: 10;
}

.qg-usdjpy-evolution__list--causal {
  order: 11;
}

.qg-usdjpy-evolution__list--news {
  order: 12;
}

.qg-usdjpy-evolution__list--scenarios {
  order: 13;
}

.qg-usdjpy-evolution__list--walk-forward {
  order: 14;
}

.qg-usdjpy-evolution__list--candidates {
  order: 15;
}

.qg-usdjpy-evolution__chapter-label--safety {
  order: 20;
}

.qg-usdjpy-evolution__list--lanes {
  order: 21;
}

.qg-usdjpy-evolution__list--agent {
  order: 22;
}

.qg-usdjpy-evolution__list--daily {
  order: 23;
}

.qg-usdjpy-evolution__chapter-label--ga {
  order: 30;
}

.qg-usdjpy-evolution__list--ga {
  order: 31;
}

.qg-usdjpy-evolution__list--strategy-backtest {
  order: 32;
}

.qg-usdjpy-evolution__list--strategy-contract {
  order: 33;
}

.qg-usdjpy-evolution__chapter-label--execution {
  order: 40;
}

.qg-usdjpy-evolution__list--evidence-os {
  order: 41;
}

.qg-usdjpy-evolution__list--deep-evidence {
  order: 42;
}

.qg-usdjpy-evolution__list--production {
  order: 43;
}

.qg-usdjpy-evolution__section-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.qg-usdjpy-evolution__section-head > strong {
  border: 1px solid rgba(126, 203, 255, 0.35);
  border-radius: 8px;
  color: #bfe7ff;
  padding: 8px 12px;
  overflow-wrap: anywhere;
  white-space: nowrap;
}

.qg-usdjpy-evolution__section-head p {
  color: #aebbd0;
  margin-top: 6px;
}

.qg-usdjpy-evolution__scenario-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
}

.qg-usdjpy-evolution__strategy-id {
  font-size: 13px;
  color: #8fa3bd;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.qg-usdjpy-evolution__mini-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.qg-usdjpy-evolution__mini-list article {
  padding: 12px;
}

.qg-usdjpy-evolution__mini-list strong,
.qg-usdjpy-evolution__list article strong {
  overflow-wrap: anywhere;
}

.qg-usdjpy-evolution__ga-timeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.qg-usdjpy-evolution__ga-timeline article {
  padding: 12px;
}

.qg-usdjpy-evolution__table-wrap {
  overflow-x: auto;
  border: 1px solid rgba(145, 170, 210, 0.22);
  border-radius: 8px;
}

.qg-usdjpy-evolution__table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

.qg-usdjpy-evolution__table th,
.qg-usdjpy-evolution__table td {
  border-bottom: 1px solid rgba(145, 170, 210, 0.16);
  padding: 10px 12px;
  text-align: left;
  color: #dce8f8;
  white-space: nowrap;
}

.qg-usdjpy-evolution__table th {
  color: #9fb3cc;
  font-weight: 800;
}

.qg-usdjpy-evolution__table tbody tr {
  cursor: pointer;
}

.qg-usdjpy-evolution__candidate--elite_selected td {
  color: #86efac;
}

.qg-usdjpy-evolution__candidate--rejected td,
.qg-usdjpy-evolution__candidate--safety_rejected td {
  color: #fca5a5;
}

.qg-usdjpy-evolution__seed-detail {
  display: grid;
  gap: 10px;
  border: 1px solid rgba(126, 203, 255, 0.3);
  border-radius: 8px;
  padding: 14px;
  background: rgba(2, 11, 24, 0.55);
}

.qg-usdjpy-evolution__seed-detail-state {
  padding: 10px 12px;
  border: 1px solid rgba(126, 203, 255, 0.24);
  border-radius: 8px;
  background: rgba(14, 42, 72, 0.34);
}

.qg-usdjpy-evolution__seed-audit-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) repeat(2, minmax(190px, 1fr));
  gap: 10px;
}

.qg-usdjpy-evolution__seed-audit-grid article,
.qg-usdjpy-evolution__evidence-chain article {
  padding: 12px;
  border: 1px solid rgba(145, 170, 210, 0.18);
  border-radius: 8px;
  background: rgba(10, 25, 48, 0.68);
}

.qg-usdjpy-evolution__equity-card svg {
  width: 100%;
  height: 72px;
  margin: 8px 0;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(5, 15, 31, 0.96), rgba(9, 26, 48, 0.8));
}

.qg-usdjpy-evolution__equity-card polyline {
  fill: none;
  stroke: #67e8f9;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.6;
}

.qg-usdjpy-evolution__lineage-path {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(250, 204, 21, 0.48);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(44, 33, 9, 0.5), rgba(8, 18, 35, 0.62));
}

.qg-usdjpy-evolution__lineage-path-head span {
  display: block;
  color: #ffe58a;
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}

.qg-usdjpy-evolution__lineage-path-head strong {
  display: block;
  margin-top: 4px;
  color: #f8fbff;
  font-size: 1.05rem;
}

.qg-usdjpy-evolution__lineage-path-track {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.qg-usdjpy-evolution__lineage-path-node {
  position: relative;
  min-width: 0;
  padding: 11px 12px 11px 18px;
  border: 1px solid rgba(88, 116, 158, 0.72);
  border-radius: 8px;
  background: rgba(9, 19, 37, 0.76);
}

.qg-usdjpy-evolution__lineage-path-node::before {
  position: absolute;
  top: 15px;
  left: 7px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #9fb0c8;
  content: '';
}

.qg-usdjpy-evolution__lineage-path-node--elite {
  border-color: rgba(250, 204, 21, 0.9);
}

.qg-usdjpy-evolution__lineage-path-node--elite::before {
  background: #ffe58a;
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.16);
}

.qg-usdjpy-evolution__lineage-path-node--selected {
  border-color: rgba(94, 234, 212, 0.95);
  background: rgba(14, 46, 65, 0.62);
}

.qg-usdjpy-evolution__lineage-path-node--selected::before {
  background: #5eead4;
  box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.16);
}

.qg-usdjpy-evolution__lineage-path-node span {
  display: block;
  color: #9fb0c8;
  font-size: 0.72rem;
  font-weight: 900;
}

.qg-usdjpy-evolution__lineage-path-node strong {
  display: block;
  margin-top: 4px;
  color: #eef5ff;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.qg-usdjpy-evolution__lineage-tree {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgba(72, 101, 145, 0.65);
  border-radius: 8px;
  background: rgba(8, 16, 32, 0.42);
}

.qg-usdjpy-evolution__lineage-tree-head span,
.qg-usdjpy-evolution__lineage-edges > span {
  display: block;
  color: #8fbdf0;
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}

.qg-usdjpy-evolution__lineage-tree-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
}

.qg-usdjpy-evolution__lineage-tree-head strong {
  display: block;
  margin-top: 4px;
  color: #f4f8ff;
  font-size: 1.05rem;
}

.qg-usdjpy-evolution__lineage-toggle {
  min-height: 34px;
  padding: 7px 10px;
  border: 1px solid rgba(83, 180, 255, 0.7);
  border-radius: 8px;
  background: rgba(18, 61, 97, 0.42);
  color: #e8f3ff;
  font-size: 0.74rem;
  font-weight: 900;
  cursor: pointer;
}

.qg-usdjpy-evolution__lineage-levels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  align-items: stretch;
}

.qg-usdjpy-evolution__lineage-level {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(55, 84, 126, 0.7);
  border-radius: 8px;
  background: rgba(10, 20, 39, 0.72);
}

.qg-usdjpy-evolution__lineage-level > span {
  color: #9fb0c8;
  font-size: 0.75rem;
  font-weight: 900;
}

.qg-usdjpy-evolution__lineage-node {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid rgba(69, 100, 145, 0.8);
  border-radius: 8px;
  background: rgba(16, 28, 51, 0.82);
}

.qg-usdjpy-evolution__lineage-node--selected {
  border-color: rgba(94, 234, 212, 0.95);
  box-shadow: 0 0 0 1px rgba(94, 234, 212, 0.2);
}

.qg-usdjpy-evolution__lineage-node--elite-path {
  border-color: rgba(250, 204, 21, 0.92);
  background: linear-gradient(135deg, rgba(67, 51, 13, 0.58), rgba(16, 28, 51, 0.82));
}

.qg-usdjpy-evolution__lineage-node--elite {
  box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.3);
}

.qg-usdjpy-evolution__lineage-node--external {
  border-style: dashed;
  opacity: 0.82;
}

.qg-usdjpy-evolution__lineage-node strong {
  display: block;
  color: #eef5ff;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.qg-usdjpy-evolution__lineage-node em {
  display: inline-block;
  margin-top: 5px;
  color: #ffe58a;
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 900;
}

.qg-usdjpy-evolution__lineage-edges {
  display: grid;
  gap: 8px;
}

.qg-usdjpy-evolution__lineage-edges article {
  padding: 9px 10px;
  border: 1px solid rgba(55, 84, 126, 0.6);
  border-radius: 8px;
  background: rgba(8, 16, 32, 0.58);
}

.qg-usdjpy-evolution__lineage-edge--elite-path {
  border-color: rgba(250, 204, 21, 0.8) !important;
  background: rgba(70, 54, 16, 0.46) !important;
}

.qg-usdjpy-evolution__lineage-edges strong {
  display: block;
  color: #e8f2ff;
  overflow-wrap: anywhere;
}

.qg-usdjpy-evolution__evidence-chain {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.qg-usdjpy-evolution__evidence-chain > span {
  grid-column: 1 / -1;
  color: #9fb3cc;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.qg-usdjpy-evolution__evidence-chain em {
  display: inline-block;
  margin: 4px 0;
  color: #fde68a;
  font-style: normal;
  font-weight: 900;
}

.qg-usdjpy-evolution__seed-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
}

.qg-usdjpy-evolution__seed-metrics article {
  padding: 12px;
}

.qg-usdjpy-evolution__seed-detail pre {
  max-height: 320px;
  overflow: auto;
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.32);
  color: #bfe7ff;
  font-size: 12px;
}

.qg-usdjpy-evolution__note {
  color: #8ea3bd;
  font-size: 14px;
}

.qg-usdjpy-evolution__state {
  order: 3;
  border: 1px solid rgba(145, 170, 210, 0.22);
  border-radius: 8px;
  padding: 18px;
  color: #aebbd0;
}

.qg-usdjpy-evolution__state--error {
  color: #ffb3bd;
}

@media (max-width: 900px) {
  .qg-usdjpy-evolution__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .qg-usdjpy-evolution__primary-actions,
  .qg-usdjpy-evolution__more-actions div {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .qg-usdjpy-evolution__seed-audit-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .qg-usdjpy-evolution__header {
    grid-template-columns: 1fr;
  }

  .qg-usdjpy-evolution__primary-actions,
  .qg-usdjpy-evolution__more-actions div,
  .qg-usdjpy-evolution__grid,
  .qg-usdjpy-evolution__scenario-grid,
  .qg-usdjpy-evolution__mini-list,
  .qg-usdjpy-evolution__ga-timeline,
  .qg-usdjpy-evolution__seed-metrics,
  .qg-usdjpy-evolution__evidence-chain {
    grid-template-columns: 1fr;
  }

  .qg-usdjpy-evolution__section-head,
  .qg-usdjpy-evolution__lineage-tree-head {
    display: grid;
  }

  .qg-usdjpy-evolution__section-head > strong {
    white-space: normal;
  }
}
</style>
